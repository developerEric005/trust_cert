import { Component, type ReactNode } from 'react'

export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="text-lg font-semibold text-navy-900">Something went wrong.</p>
        <button className="mt-4 rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white" onClick={() => window.location.assign('/')}>
          Back to start
        </button>
      </div>
    )
  }
}
