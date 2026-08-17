/**
 * POST /api/chat
 * Body: { messages: [{role:'user'|'assistant', content: string | ContentBlock[]}, ...], currentConfig?: object, pastDesigns?: object[] }
 * ContentBlock: {type:'text', text:string} | {type:'image', source:{type:'base64', media_type:string, data:string}}
 * Returns: { reply: string, config: object|null }
 *
 * Image attachments (Style/Image Recognition): the client resizes a photo
 * client-side and sends it as an 'image' content block alongside 'text' in
 * the same user message — see sanitizeMessages() for the allow-listed
 * media types and size cap. No separate vision endpoint or model: the same
 * Claude call just reads the photo and calls set_furniture_config, exactly
 * like it would from a text description.
 *
 * pastDesigns (optional): the signed-in user's recent saved designs (from
 * Supabase `projects`), each a raw cfg-shaped object + createdAt. Used only
 * as read-only prompt context so the AI can reference "the one from last
 * time" — see buildSystemPrompt(). Persistence itself (writing to Supabase
 * `ai_conversations`/`projects`) happens client-side in index.html, not here.
 *
 * AI Furniture Designer for the FurniAI configurator (static site, no framework).
 * Stateless — the client resends the full conversation each turn.
 *
 * Vocabulary here mirrors the LIVE configurator's cfg shape exactly
 * (type/sections/drawers/shelves/doorType/mat/handle/led/w/h/d in DESIGNS,
 * index.html) — NOT the different schema used by the in-development Next.js
 * app in src/. Do not merge these two vocabularies.
 */
const Anthropic = require('@anthropic-ai/sdk');
const { evaluateConstruction, PANEL_THK_CM, SHELF_SPAN_INFO_CM } = require('./constructionValidator');

const MODEL = 'claude-sonnet-4-6';

const TYPES = ['wardrobe','walkin_l','walkin_u','kitchen','kitchen_l','kitchen_u','kitchen_island','vanity_freestanding','vanity_floating','bookshelf','sideboard'];
const MATERIALS = ['oak','walnut','white','grey','taupe','cream','black','navy','sage','terracotta','mahogany','ash','ivory'];
const HANDLES = ['gold','black','chrome','push','none'];
const DOOR_TYPES = ['glass','solid','mirror','open'];
const LED_MODES = ['warm','cool','off'];
const PART_ROLES = ['panel','shelf','door','drawer','leg','back'];

// Matches the per-type slider ranges set in index.html Builder.load()
const RANGES = {
  wardrobe:{w:[120,360],h:[180,280],d:[40,80]},
  walkin_l:{w:[120,360],h:[180,280],d:[40,80]},
  walkin_u:{w:[120,360],h:[180,280],d:[40,80]},
  kitchen:{w:[120,360],h:[180,250],d:[50,70]},
  kitchen_l:{w:[120,360],h:[180,250],d:[50,70]},
  kitchen_u:{w:[120,360],h:[180,250],d:[50,70]},
  kitchen_island:{w:[120,360],h:[180,250],d:[50,70]},
  vanity_freestanding:{w:[60,240],h:[45,100],d:[40,65]},
  vanity_floating:{w:[60,240],h:[45,100],d:[40,65]},
  bookshelf:{w:[60,240],h:[150,240],d:[25,50]},
  sideboard:{w:[100,240],h:[45,100],d:[35,55]},
};

// Generous bounding box for a fully custom piece — anything from a stool to
// a large cabinet — separate from the preset RANGES above since a custom
// design isn't one of the 11 preset types.
const CUSTOM_RANGE = { w:[10,400], h:[10,300], d:[10,120] };
const MAX_CUSTOM_PARTS = 40;
const PART_DIM_RANGE = [1,400];
const PART_POS_RANGE = [-250,250];

// Active preference memory: today's passive recall only surfaces past
// designs if the customer brings them up ("the one from last time"). This
// notices real MAJORITY patterns (a choice repeated in over half their past
// designs, not a one-off) and feeds them as a soft default bias — so a
// returning customer who always picks oak + gold gets that instead of the
// generic fallback defaults, without ever overriding what they explicitly
// ask for this time. Needs at least 2 past designs; a single data point
// isn't a pattern.
function mostCommon(values){
  const counts={};
  values.forEach(v=>{if(v!==undefined&&v!==null)counts[v]=(counts[v]||0)+1});
  let best=null,bestCount=0;
  for(const v in counts){if(counts[v]>bestCount){best=v;bestCount=counts[v]}}
  return best?{value:best,count:bestCount,total:values.length}:null;
}
function summarizePreferences(pastDesigns){
  if(!pastDesigns||pastDesigns.length<2)return null;
  const presets=pastDesigns.filter(d=>d.type!=='custom');
  const fields=[
    ['material',pastDesigns.map(d=>d.mat)],
    ['handle',presets.map(d=>d.handle)],
    ['door type',presets.map(d=>d.doorType)],
    ['LED',presets.map(d=>d.led)],
  ];
  const notes=[];
  fields.forEach(([label,values])=>{
    const mode=mostCommon(values.filter(Boolean));
    if(mode&&mode.count/mode.total>0.5)notes.push(`${label}: ${mode.value} (${mode.count}/${mode.total} past designs)`);
  });
  return notes.length?notes:null;
}

function buildSystemPrompt(pastDesigns){
  const memoryBlock = pastDesigns && pastDesigns.length
    ? `\n\nThis user is signed in and has designed before. Their recent saved designs (most recent first), for reference ONLY if they mention something like "the one from last time" or "another wardrobe like before" — don't bring them up unprompted:\n${pastDesigns.map((d,i)=>`${i+1}. "${d.name}" — ${d.type.replace(/_/g,' ')}, ${d.w}x${d.h}x${d.d}cm, ${d.mat}, saved ${d.createdAt}`).join('\n')}`
    : '';
  const preferences = summarizePreferences(pastDesigns);
  const preferenceBlock = preferences
    ? `\n\nThis customer's typical preferences, based on a real majority across their past designs: ${preferences.join('; ')}. When they don't specify a preference for a NEW design, lean toward these instead of the generic defaults — but always defer to whatever they explicitly ask for this time, and don't mention this reasoning unprompted.`
    : '';
  return `You are the AI Furniture Designer for FurniAI, a browser-based custom-furniture design application — not a store, it never shows prices.
You help people design real, manufacturable furniture through conversation, then hand off a parametric model to a live 3D configurator.

Voice: concise, expert, a little inspiring — like a good interior designer. No emoji unless the user uses them first.

Your job each turn:
1. Understand the furniture the user wants: type, rough size, style, materials, doors, drawers, shelves, handles, lighting.
2. If it matches one of the 11 preset types below, call set_furniture_config as soon as you can identify at least a TYPE. Don't interrogate the user for every field — use sensible defaults for anything unstated. Ask at most one clarifying question, only if genuinely ambiguous.
3. If it does NOT match a preset type — a chair, table, bed, desk, stool, bench, or any genuinely custom/asymmetric piece — call set_custom_design instead (see below). Never force an unrelated request into one of the 11 presets just because it's the closest thing available.
4. When refining an existing design ("make it wider", "add a drawer", "change to walnut", "add a leg", "move the shelf up"), call the SAME tool again with the FULL updated config/parts — carry over everything from the current design, changing only what the user asked.
5. After the tool result comes back, reply with a short, natural confirmation of what you built or changed — describe it like a designer would, don't recite raw numbers robotically.

## Custom designs (set_custom_design)

Use this whenever the request isn't one of the 11 preset types. Build the
piece out of generic parts — role is one of ${PART_ROLES.join(', ')}. Every
part is a rectangular box: give its own w (left-right)/h (vertical)/d
(front-back) size in cm, plus x/y/z for the CENTER of that part.

Coordinate system: origin is the center of the piece's own overall bounding
box. x=0 is left-right center, y=0 is vertical center (so the floor is at
y = -h/2, where h is the overall height you pass), z=0 is front-back center.

STACKING RULE — apply this mechanically for every part, don't estimate:
if part B rests directly on top of part A, then
  B.y = (A.y + A.h / 2) + B.h / 2
("A's top surface" + "half of B's own height"). The floor itself is a
surface at y = -overallH/2, so a part resting on the floor is just this
same rule with A.y + A.h/2 replaced by -overallH/2. Getting this wrong by
even half a part's thickness makes it visibly sink into or float above
whatever it should be resting on — always compute it, never approximate.

DECLARE WHAT EVERY PART RESTS ON — not optional, do this for every single
part: set restsOnFloor:true for anything sitting directly on the floor
(most legs), or restsOnParts:[i,j,...] (0-based indices into this same
parts array) for anything resting on top of other parts (a tabletop on its
legs, a shelf on a divider). This lets a deterministic checker verify your
y-coordinate arithmetic exactly and tell you precisely which part is wrong
by how much — it can only do that for relationships you actually declare,
so an undeclared part is invisible to the check even if its position is
wrong. A part floating in open space with nothing under it (e.g. a
backrest attached to the sides, not resting on the seat) can leave both
fields empty/omitted.

Worked example — a simple 40×45×40cm oak side table (4 legs + a top):
- Overall: w=40, h=45, d=40 → floor is at y=-22.5
- Legs rest on the floor: leg h=42, so leg.y = -22.5 + 42/2 = -1.5 → restsOnFloor:true
- Top rests on the legs (say legs are parts 0-3): leg top surface = -1.5 + 42/2 = 19.5; top h=3, so top.y = 19.5 + 3/2 = 21 → restsOnParts:[0,1,2,3]
- role="leg" ×4: w=4, h=42, d=4, y=-1.5, at x=±18, z=±18, restsOnFloor:true
- role="panel" (the top): w=40, h=3, d=40, y=21, restsOnParts:[0,1,2,3]
Before calling the tool, re-derive every y this same way — don't reuse a
number from a different example. A real, deterministic checker verifies
every declared resting relationship and every overlap, and can propose an
exact correction — but that's a backstop, not a substitute for computing it
right the first time.

Reuse the SAME material vocabulary (mat) as the preset types. Keep the part
count reasonable (a real piece of furniture rarely needs more than ~15-20
parts) — don't over-decompose simple shapes.

REAL CONSTRUCTION KNOWLEDGE — use these, don't guess proportions from scratch:
- Flat parts (panel/shelf/door/drawer/back) should be ${PANEL_THK_CM}cm thick — this catalog's real board thickness, same as every preset type. Legs and other frame/structural members can be thicker (3-6cm) for strength.
- A flat panel spanning more than ${SHELF_SPAN_INFO_CM}cm unsupported (no leg/divider anywhere under its middle) will sag visibly in reality — real shelving deflection standards (L/360 rule). For anything wider than that, add a center leg, divider, or extra support rather than one long unsupported span.
- Real reference heights, so proportions read as genuine furniture rather than arbitrary boxes: dining/desk-height table ~72-76cm, coffee table ~40-45cm, side/accent table ~45-55cm, dining/office chair seat ~43-46cm (seat surface height, not overall), bench ~45-50cm, bed frame (mattress support surface) ~35-45cm off the floor. Use these as a starting point and adjust for what the customer actually asked for.

If the user attaches a photo of furniture: briefly describe what you see (furniture type, style, material/color, door type or, for a non-preset piece, its overall shape and construction), then build it — don't wait for the user to type anything else first. Same rule as text: if it matches a preset type, map your read onto the vocabulary below and call set_furniture_config; if it's a chair, table, bed, desk, stool, bench, or anything else that isn't a preset, call set_custom_design instead, estimating each part's size/position from the photo the same way you would from a text description (reference heights and the stacking rule above still apply — a photo doesn't exempt you from computing real coordinates). Dimension estimates from a photo are inherently approximate — reasonable proportions, not tape-measure precision — say so if asked, don't imply false accuracy. If the photo is ambiguous (can't tell material, type, or proportions), say so plainly and ask ONE clarifying question rather than guessing wildly. Never claim to recognize a specific real product or brand from a photo — describe the style/material/construction you observe, not a guess at its commercial source.

Vocabulary you must map onto:
- Furniture types: ${TYPES.join(', ')} (walkin_l/walkin_u = L/U-shaped walk-in closets; kitchen_l/kitchen_u/kitchen_island = kitchen layouts; vanity_freestanding/vanity_floating = bathroom vanities)
- Materials: ${MATERIALS.join(', ')}
- Door types: ${DOOR_TYPES.join(', ')} (open = no doors, just open shelving)
- Handles: ${HANDLES.join(', ')} (push = handleless push-to-open, none = no handle hardware)
- LED: ${LED_MODES.join(', ')}
- Dimensions are in CENTIMETRES.

Never invent or mention a price — this application does not show prices.

After each set_furniture_config call, the tool result also includes "findings" — construction notes graded by severity ("warning" or "info"), generated by a deterministic rule checker, not by you. Weave any "warning" findings into your reply naturally (e.g. suggest the fix). Only mention an "info" finding if it's directly relevant to what the customer just asked for — never recite the full list like a report.${memoryBlock}${preferenceBlock}`;
}

const CONFIG_TOOL={
  name:'set_furniture_config',
  description:'Create or update the parametric furniture model shown in the 3D configurator. Always pass the complete config (all fields), even when only changing one thing.',
  input_schema:{
    type:'object',
    properties:{
      name:{type:'string',description:'Short display name, e.g. "Modern Oak Wardrobe"'},
      type:{type:'string',enum:TYPES},
      sections:{type:'integer',minimum:1,maximum:6},
      drawers:{type:'integer',minimum:0,maximum:6},
      shelves:{type:'integer',minimum:0,maximum:7},
      doorType:{type:'string',enum:DOOR_TYPES},
      mat:{type:'string',enum:MATERIALS},
      handle:{type:'string',enum:HANDLES},
      led:{type:'string',enum:LED_MODES},
      w:{type:'number',description:'width in cm'},
      h:{type:'number',description:'height in cm'},
      d:{type:'number',description:'depth in cm'},
    },
    required:['type','sections','drawers','shelves','doorType','mat','handle','led','w','h','d'],
    additionalProperties:false,
  },
};

const CUSTOM_TOOL={
  name:'set_custom_design',
  description:'Create or update a fully custom furniture piece assembled from generic parts (panels, shelves, doors, drawers, legs, backs) — use this for furniture that is NOT one of the 11 preset types (a chair, table, bed, desk, stool, bench, or any unique/asymmetric piece). Always pass the COMPLETE parts list, including every part from earlier turns, even when only adding, removing, or moving one part.',
  input_schema:{
    type:'object',
    properties:{
      name:{type:'string',description:'Short display name, e.g. "Oak Side Table"'},
      mat:{type:'string',enum:MATERIALS},
      w:{type:'number',description:'overall bounding width in cm'},
      h:{type:'number',description:'overall bounding height in cm'},
      d:{type:'number',description:'overall bounding depth in cm'},
      parts:{
        type:'array',
        description:"Every part of the piece. Coordinates in cm, origin at the center of the overall bounding box: x=0 left-right center, y=0 vertical center (floor is at y=-h/2), z=0 front-back center. A part's x/y/z is that part's own center.",
        items:{
          type:'object',
          properties:{
            role:{type:'string',enum:PART_ROLES},
            w:{type:'number',description:'part width (left-right) in cm'},
            h:{type:'number',description:'part height (vertical) in cm'},
            d:{type:'number',description:'part depth (front-back) in cm'},
            x:{type:'number'},
            y:{type:'number'},
            z:{type:'number'},
            restsOnFloor:{type:'boolean',description:'true if this part\'s bottom edge should sit exactly on the floor'},
            restsOnParts:{type:'array',items:{type:'integer'},description:'0-based indices, within this same parts array, of the OTHER part(s) this part rests directly on top of'},
          },
          required:['role','w','h','d','x','y','z'],
          additionalProperties:false,
        },
      },
    },
    required:['name','mat','w','h','d','parts'],
    additionalProperties:false,
  },
};

const CORRECTION_FIELDS=['type','mat','doorType','handle','led','style','dimensions','other'];
const LOG_CORRECTION_TOOL={
  name:'log_correction',
  description:"Record a genuine correction the customer made to something YOU got wrong — not a routine change of mind. Use this in the SAME turn as fixing the design (call this alongside set_furniture_config/set_custom_design), most often right after a photo misread (\"that's walnut, not oak\") or a misidentified type (\"it's a bench, not a table\"). Do NOT call this for a customer simply changing their preference (\"actually make it black instead\") — only when you stated or implied something incorrect and they're correcting YOUR error.",
  input_schema:{
    type:'object',
    properties:{
      field:{type:'string',enum:CORRECTION_FIELDS,description:'What kind of thing you got wrong'},
      wrongValue:{type:'string',description:'What you said/assumed (short)'},
      correctValue:{type:'string',description:"What the customer corrected it to (short)"},
    },
    required:['field','wrongValue','correctValue'],
    additionalProperties:false,
  },
};

function oneOf(v,allowed,fallback){return allowed.includes(v)?v:fallback}
function clampInt(v,min,max,fallback){const n=Math.round(Number(v));if(!Number.isFinite(n))return fallback;return Math.min(max,Math.max(min,n))}
function clampNum(v,min,max,fallback){const n=Number(v);if(!Number.isFinite(n))return fallback;return Math.min(max,Math.max(min,n))}

// Defense-in-depth: never let raw model output drive geometry directly.
// Every field is validated against the known vocabulary and clamped to a
// manufacturable range before it ever reaches the 3D builder.
function sanitizeConfig(raw){
  const type=oneOf(raw.type,TYPES,'wardrobe');
  const range=RANGES[type];
  return {
    name:typeof raw.name==='string'&&raw.name.trim()?raw.name.trim().slice(0,60):'AI Design',
    type,
    sections:clampInt(raw.sections,1,6,4),
    drawers:clampInt(raw.drawers,0,6,0),
    shelves:clampInt(raw.shelves,0,7,3),
    doorType:oneOf(raw.doorType,DOOR_TYPES,'solid'),
    mat:oneOf(raw.mat,MATERIALS,'oak'),
    handle:oneOf(raw.handle,HANDLES,'black'),
    led:oneOf(raw.led,LED_MODES,'warm'),
    w:clampNum(raw.w,range.w[0],range.w[1],Math.round((range.w[0]+range.w[1])/2)),
    h:clampNum(raw.h,range.h[0],range.h[1],Math.round((range.h[0]+range.h[1])/2)),
    d:clampNum(raw.d,range.d[0],range.d[1],Math.round((range.d[0]+range.d[1])/2)),
  };
}

// Same defense-in-depth principle as sanitizeConfig, applied to a custom
// design's parts array: every part is independently validated/clamped, never
// trusted as-is, and the part count is capped so a pathological response
// can't produce an unbounded scene.
function sanitizeCustomPart(raw){
  return {
    role:oneOf(raw&&raw.role,PART_ROLES,'panel'),
    w:clampNum(raw&&raw.w,PART_DIM_RANGE[0],PART_DIM_RANGE[1],30),
    h:clampNum(raw&&raw.h,PART_DIM_RANGE[0],PART_DIM_RANGE[1],30),
    d:clampNum(raw&&raw.d,PART_DIM_RANGE[0],PART_DIM_RANGE[1],2),
    x:clampNum(raw&&raw.x,PART_POS_RANGE[0],PART_POS_RANGE[1],0),
    y:clampNum(raw&&raw.y,PART_POS_RANGE[0],PART_POS_RANGE[1],0),
    z:clampNum(raw&&raw.z,PART_POS_RANGE[0],PART_POS_RANGE[1],0),
    restsOnFloor:!!(raw&&raw.restsOnFloor),
    restsOnParts:Array.isArray(raw&&raw.restsOnParts)?raw.restsOnParts.filter(n=>Number.isInteger(n)):[],
  };
}
function sanitizeCustomDesign(raw){
  const parts=Array.isArray(raw.parts)?raw.parts.slice(0,MAX_CUSTOM_PARTS).map(sanitizeCustomPart):[];
  // Second pass: restsOnParts indices are only meaningful once the final
  // array length is known — drop anything out of range or self-referencing.
  parts.forEach((p,i)=>{p.restsOnParts=p.restsOnParts.filter(idx=>idx>=0&&idx<parts.length&&idx!==i)});
  return {
    name:typeof raw.name==='string'&&raw.name.trim()?raw.name.trim().slice(0,60):'Custom Design',
    type:'custom',
    mat:oneOf(raw.mat,MATERIALS,'oak'),
    w:clampNum(raw.w,CUSTOM_RANGE.w[0],CUSTOM_RANGE.w[1],60),
    h:clampNum(raw.h,CUSTOM_RANGE.h[0],CUSTOM_RANGE.h[1],75),
    d:clampNum(raw.d,CUSTOM_RANGE.d[0],CUSTOM_RANGE.d[1],45),
    parts,
  };
}

function sanitizeCorrection(raw){
  const field=oneOf(raw&&raw.field,CORRECTION_FIELDS,'other');
  const wrongValue=typeof (raw&&raw.wrongValue)==='string'?raw.wrongValue.trim().slice(0,80):'';
  const correctValue=typeof (raw&&raw.correctValue)==='string'?raw.correctValue.trim().slice(0,80):'';
  if(!wrongValue||!correctValue)return null;
  return {field,wrongValue,correctValue};
}

// Defense-in-depth applies here too: pastDesigns comes from the client
// (sourced from the user's own Supabase rows, but still untrusted input to
// this endpoint) — every field is re-validated against the same vocabulary
// before it can reach the prompt. Only ever used as text context, never
// executed or passed to a tool, so worst case is a malformed prompt line.
function sanitizePastDesigns(raw){
  if(!Array.isArray(raw))return[];
  return raw.slice(0,5)
    .filter(d=>d&&typeof d==='object')
    .map(d=>{
      // A saved custom design must go through its own sanitizer — sanitizeConfig()
      // forces type into the 11-preset enum (custom isn't in TYPES, so it would
      // silently become a fake "wardrobe" and lose the parts array entirely).
      const sanitized=d.type==='custom'?sanitizeCustomDesign(d):sanitizeConfig(d);
      return {...sanitized,createdAt:typeof d.createdAt==='string'?d.createdAt.slice(0,10):'unknown date'};
    });
}

// Defense-in-depth for chat messages too: content is either a plain string
// (existing behaviour) or an array of Anthropic content blocks (image
// attachments). Every block is re-validated here — allow-listed image media
// types only, a size cap well under Vercel's request-body limit — rather
// than trusting whatever shape the client sends straight through to the API.
const ALLOWED_IMAGE_TYPES=['image/jpeg','image/png','image/gif','image/webp'];
const MAX_IMAGE_B64_CHARS=6000000; // ~4.5MB binary — generous for a client-resized photo
const MAX_TEXT_CHARS=4000;
function sanitizeContentBlock(block){
  if(!block||typeof block!=='object')return null;
  if(block.type==='text'){
    const text=typeof block.text==='string'?block.text.slice(0,MAX_TEXT_CHARS):'';
    return text?{type:'text',text}:null;
  }
  if(block.type==='image'){
    const src=block.source;
    if(!src||src.type!=='base64'||!ALLOWED_IMAGE_TYPES.includes(src.media_type))return null;
    if(typeof src.data!=='string'||!src.data||src.data.length>MAX_IMAGE_B64_CHARS)return null;
    return{type:'image',source:{type:'base64',media_type:src.media_type,data:src.data}};
  }
  return null;
}
function sanitizeMessages(raw){
  return raw.map(m=>{
    if(!m||(m.role!=='user'&&m.role!=='assistant'))return null;
    if(typeof m.content==='string')return{role:m.role,content:m.content.slice(0,MAX_TEXT_CHARS)};
    if(Array.isArray(m.content)){
      const blocks=m.content.map(sanitizeContentBlock).filter(Boolean);
      return blocks.length?{role:m.role,content:blocks}:null;
    }
    return null;
  }).filter(Boolean);
}

module.exports = async (req,res)=>{
  if(req.method!=='POST'){res.status(405).json({error:'Method not allowed'});return}
  if(!process.env.ANTHROPIC_API_KEY){res.status(500).json({error:'AI service is temporarily unavailable.'});return}

  let body=req.body;
  if(!body||typeof body==='string'){
    try{body=JSON.parse(body||'{}')}catch{body={}}
  }
  const messages=Array.isArray(body.messages)?body.messages:null;
  if(!messages||messages.length===0){res.status(400).json({error:'Body must include a non-empty messages array'});return}
  const pastDesigns=sanitizePastDesigns(body.pastDesigns);

  const anthropic=new Anthropic({apiKey:process.env.ANTHROPIC_API_KEY});
  const apiMessages=sanitizeMessages(messages);
  if(apiMessages.length===0){res.status(400).json({error:'No valid messages after validation'});return}

  let config=null;
  let findings=[];
  let correction=null;
  try{
    for(let hop=0;hop<3;hop++){
      const resp=await anthropic.messages.create({
        model:MODEL,
        max_tokens:2048,
        system:buildSystemPrompt(pastDesigns),
        tools:[CONFIG_TOOL,CUSTOM_TOOL,LOG_CORRECTION_TOOL],
        messages:apiMessages,
      });

      if(resp.stop_reason==='tool_use'){
        apiMessages.push({role:'assistant',content:resp.content});
        const toolResults=[];
        for(const block of resp.content){
          if(block.type!=='tool_use')continue;
          if(block.name==='set_furniture_config'){
            config=sanitizeConfig(block.input||{});
            findings=evaluateConstruction(config);
            toolResults.push({type:'tool_result',tool_use_id:block.id,content:JSON.stringify({applied:config,findings})});
          } else if(block.name==='set_custom_design'){
            config=sanitizeCustomDesign(block.input||{});
            findings=evaluateConstruction(config);
            toolResults.push({type:'tool_result',tool_use_id:block.id,content:JSON.stringify({applied:config,findings})});
          } else if(block.name==='log_correction'){
            correction=sanitizeCorrection(block.input||{});
            toolResults.push({type:'tool_result',tool_use_id:block.id,content:JSON.stringify({logged:!!correction})});
          }
        }
        apiMessages.push({role:'user',content:toolResults});
        continue;
      }

      const reply=resp.content.filter(b=>b.type==='text').map(b=>b.text).join('\n').trim();
      res.status(200).json({reply,config,findings,correction});
      return;
    }
    res.status(200).json({
      reply:config?"Here's your design — tell me what to change next.":'Tell me a bit more about the piece you have in mind.',
      config,
      findings,
      correction,
    });
  }catch(err){
    safeLogError(err);
    res.status(500).json({error:'Agent failed'});
  }
};

function safeLogError(err){
  const safeInfo = {
    name: err && err.name ? String(err.name) : 'Error',
    status: err && err.status ? Number(err.status) : 500,
    code: err && err.code ? String(err.code) : 'UNKNOWN_ERROR',
  };
  console.error('chat agent error:', JSON.stringify(safeInfo));
}

// `module.exports` was reassigned to the handler function above, so the
// export must be attached there (not on `module` itself) — a property on
// `module` is invisible to `require("./chat.js").safeLogError`, which is
// exactly how the regression test below reaches this function.
module.exports.safeLogError = safeLogError;

