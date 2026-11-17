import { Component } from 'react'
import type { ReactNode } from 'react'

export class LoginSceneBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  override state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  override componentDidCatch() {
    this.props.onFailure()
  }

  override render() {
    return this.state.failed ? null : this.props.children
  }
}
