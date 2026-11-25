import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ColdiAvatar } from './ColdiAvatar';

interface Props {
  children: ReactNode;
  onReset: () => void;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Coldi UI boundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-md mx-auto my-12 rounded-3xl p-7 bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 shadow-soft text-center space-y-4">
          <div className="flex justify-center">
            <ColdiAvatar pose="thinking" size="lg" />
          </div>
          <h2 className="font-display font-bold text-lg text-[#2E1F3E] dark:text-white">
            Algo salió inesperado en esta vista
          </h2>
          <p className="text-xs text-[#735F8C] dark:text-[#A996C3]">
            Tus datos siguen intactos. Vuelve al inicio para continuar.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false });
              this.props.onReset();
            }}
            className="px-5 py-2.5 rounded-2xl bg-accent hover:bg-accent-dark text-white text-xs font-bold shadow-soft"
          >
            Volver al Inicio
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
