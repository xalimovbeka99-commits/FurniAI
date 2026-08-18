// Diagnostic-only: runs once, in the main Playwright process, after every
// test/worker has finished and Playwright's own webServer teardown has
// been invoked, right before the process would normally exit and print
// its final summary. If the reported "all tests print ok but Playwright
// never exits" symptom recurs, this is the concrete evidence needed to
// find the actual open handle instead of continuing to guess — logs
// exactly what Node's event loop still considers active at that moment.
// Does not modify test results and does not force-exit anything itself.
module.exports = async function globalTeardown() {
  try {
    const handles = typeof process._getActiveHandles === "function" ? process._getActiveHandles() : [];
    const requests = typeof process._getActiveRequests === "function" ? process._getActiveRequests() : [];
    const summarize = (h) => {
      const ctorName = h && h.constructor && h.constructor.name;
      if (ctorName === "Socket" || ctorName === "TCP") {
        return { type: ctorName, remoteAddress: h.remoteAddress, remotePort: h.remotePort, localPort: h.localPort, destroyed: h.destroyed };
      }
      if (ctorName === "ChildProcess") {
        return { type: ctorName, pid: h.pid, killed: h.killed, exitCode: h.exitCode };
      }
      return { type: ctorName || typeof h };
    };
    console.log(
      "[global-teardown] active handles at end of run:",
      JSON.stringify(handles.map(summarize))
    );
    console.log(
      "[global-teardown] active requests at end of run:",
      JSON.stringify(requests.map(summarize))
    );
  } catch (err) {
    console.log("[global-teardown] diagnostic collection failed:", err && err.message);
  }
};
