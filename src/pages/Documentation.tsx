import { useMemo, useState } from "react";
import { ArrowUp, BookOpen, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { docSections, technicalDocSections } from "@/data/docSections";

export default function Documentation() {
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState("intro");
  const { isAdmin } = useIsAdmin();

  const sections = useMemo(() => {
    const userSections = docSections.filter((s) => !s.adminOnly || isAdmin);
    return isAdmin ? [...userSections, ...technicalDocSections] : userSections;
  }, [isAdmin]);

  const filteredSections = search.trim()
    ? sections.filter((s) => s.title.toLowerCase().includes(search.toLowerCase()))
    : sections;

  return (
    <div className="container max-w-6xl py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-white">Documentação</h1>
            <p className="text-sm text-white/40">Guia completo da plataforma Agentes Posológicos</p>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar navigation */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-20 space-y-1">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar seção..."
                className="pl-9 border-white/10 bg-white/[0.05] text-white text-sm placeholder:text-white/30"
              />
            </div>
            <ScrollArea className="h-[calc(100vh-12rem)]">
              <nav className="space-y-0.5 pr-2">
                {filteredSections.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setActiveSection(s.id);
                      document.getElementById(`doc-${s.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      activeSection === s.id
                        ? "bg-white/10 text-white font-medium"
                        : "text-white/50 hover:bg-white/5 hover:text-white/70"
                    }`}
                  >
                    <s.icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{s.title}</span>
                  </button>
                ))}
              </nav>
            </ScrollArea>
          </div>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-12">
          {/* Mobile search */}
          <div className="lg:hidden relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar seção..."
              className="pl-9 border-white/10 bg-white/[0.05] text-white text-sm placeholder:text-white/30"
            />
          </div>

          {filteredSections.map((section) => (
            <section
              key={section.id}
              id={`doc-${section.id}`}
              className="scroll-mt-24"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06]">
                  <section.icon className="h-4 w-4 text-primary" />
                </div>
                <h2 className="font-display text-xl font-bold text-white">{section.title}</h2>
              </div>
              <div className="pl-11">
                {section.content}
              </div>
            </section>
          ))}

          {/* Back to top */}
          <div className="flex justify-center pt-8 pb-4">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="flex items-center gap-2 text-sm text-white/30 hover:text-white/60 transition-colors"
            >
              <ArrowUp className="h-4 w-4" />
              Voltar ao topo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
