import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
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
    console.error("ErrorBoundary caught an error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[hsl(220,25%,5%)] text-white p-6 text-center">
          <AlertTriangle className="h-10 w-10 text-amber-400" />
          <div>
            <p className="font-semibold">Algo deu errado.</p>
            <p className="text-sm text-white/50">
              Se você estiver sem conexão, algumas páginas não funcionam offline.
            </p>
          </div>
          <Button onClick={() => window.location.reload()}>Tentar novamente</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
