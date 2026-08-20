"use client";

/**
 * Guards a non-essential visual enhancement (currently LocalEnvironment)
 * inside the Canvas tree. If it throws for any reason, this boundary
 * swallows it and renders nothing instead of taking down the whole
 * configurator — the wardrobe, controls, and base lighting must survive a
 * failed decorative enhancement.
 */
import { Component } from "react";

export default class SceneEnhancementBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error(
      "Non-essential scene enhancement failed; Builder continues without it:",
      error
    );
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
