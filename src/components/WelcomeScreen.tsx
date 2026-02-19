import { Bot, FolderOpen } from "lucide-react";

interface WelcomeScreenProps {
  hasProjects: boolean;
  onCreateProject: () => void;
}

export function WelcomeScreen({
  hasProjects,
  onCreateProject,
}: WelcomeScreenProps) {
  if (!hasProjects) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/50 bg-muted/30">
            <FolderOpen className="h-7 w-7 text-foreground/80" />
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">
            Open a project
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a folder to get started
          </p>
        </div>
        <button
          onClick={onCreateProject}
          className="mt-6 rounded-lg border border-border/50 bg-muted/20 px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
        >
          Choose folder
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4">
      <div className="flex flex-col items-center gap-2">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/50 bg-muted/30">
          <Bot className="h-7 w-7 text-foreground/80" />
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          Select a thread to continue
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Or start a new one from a project in the sidebar
        </p>
      </div>
    </div>
  );
}
