import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Cookie, Shield, Settings, BarChart3, Megaphone } from "lucide-react";

const COOKIES = [
  {
    icon: Shield,
    category: "Necessários",
    description: "Essenciais para o funcionamento básico do site. Não podem ser desativados.",
    cookies: [
      { name: "cookie_consent", purpose: "Armazena suas preferências de cookies", duration: "1 ano", provider: "Agentes Posológicos" },
      { name: "sidebar:state", purpose: "Salva o estado (aberto/fechado) da barra lateral", duration: "Sessão", provider: "Agentes Posológicos" },
      { name: "sb-*-auth-token", purpose: "Token de autenticação do Supabase", duration: "1 hora", provider: "Supabase" },
    ],
  },
  {
    icon: Settings,
    category: "Funcionais",
    description: "Melhoram sua experiência salvando preferências pessoais.",
    cookies: [
      { name: "preferred_language", purpose: "Idioma preferido (pt-BR, en, es)", duration: "1 ano", provider: "Agentes Posológicos" },
      { name: "last_agent_viewed", purpose: "Último agente visualizado, para sugestões", duration: "30 dias", provider: "Agentes Posológicos" },
    ],
  },
  {
    icon: BarChart3,
    category: "Analíticos",
    description: "Nos ajudam a entender como o site é usado para melhorar a plataforma.",
    cookies: [
      { name: "analytics_session", purpose: "ID anônimo de sessão para agrupar pageviews e tempo de permanência", duration: "24 horas", provider: "Agentes Posológicos" },
    ],
  },
  {
    icon: Megaphone,
    category: "Marketing",
    description: "Rastreiam a origem do tráfego para otimização de campanhas.",
    cookies: [
      { name: "utm_source", purpose: "Origem do tráfego (ex: instagram, google)", duration: "30 dias", provider: "Agentes Posológicos" },
      { name: "utm_campaign", purpose: "Nome da campanha de marketing", duration: "30 dias", provider: "Agentes Posológicos" },
    ],
  },
];

export default function CookiePolicy() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div className="flex items-center gap-2">
            <Cookie className="h-5 w-5 text-primary" />
            <h1 className="font-bold text-lg">Política de Cookies</h1>
          </div>
        </div>
      </header>

      <main className="container max-w-3xl py-12 space-y-10">
        {/* Intro */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold">O que são cookies?</h2>
          <p className="text-muted-foreground leading-relaxed">
            Cookies são pequenos arquivos de texto armazenados no seu navegador quando você visita um site.
            Eles permitem que o site lembre suas preferências, entenda como você interage com a plataforma
            e melhore sua experiência geral. No <strong>Agentes Posológicos</strong>, respeitamos sua privacidade
            e damos controle total sobre quais cookies você aceita.
          </p>
        </section>

        {/* Cookie table by category */}
        {COOKIES.map(({ icon: Icon, category, description, cookies }) => (
          <section key={category} className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{category}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            </div>

            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th className="p-3 font-medium">Cookie</th>
                    <th className="p-3 font-medium">Finalidade</th>
                    <th className="p-3 font-medium hidden sm:table-cell">Duração</th>
                    <th className="p-3 font-medium hidden md:table-cell">Provedor</th>
                  </tr>
                </thead>
                <tbody>
                  {cookies.map((c) => (
                    <tr key={c.name} className="border-t">
                      <td className="p-3 font-mono text-xs text-primary">{c.name}</td>
                      <td className="p-3 text-muted-foreground">{c.purpose}</td>
                      <td className="p-3 text-muted-foreground hidden sm:table-cell">{c.duration}</td>
                      <td className="p-3 text-muted-foreground hidden md:table-cell">{c.provider}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        {/* How to manage */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Como gerenciar cookies</h2>
          <p className="text-muted-foreground leading-relaxed">
            Você pode alterar suas preferências a qualquer momento limpando os cookies do navegador e 
            revisitando o site — o banner de consentimento aparecerá novamente. Também pode desativar 
            cookies diretamente nas configurações do seu navegador.
          </p>
        </section>

        {/* LGPD reference */}
        <section className="space-y-4 border-t pt-8">
          <h2 className="text-2xl font-bold">Base legal</h2>
          <p className="text-muted-foreground leading-relaxed">
            Esta política está em conformidade com a <strong>Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018)</strong>.
            Cookies necessários são processados com base no legítimo interesse. Todos os demais tipos de cookies
            só são ativados após seu consentimento explícito. Para mais detalhes, consulte nossa{" "}
            <Link to="/privacidade" className="text-primary underline hover:text-primary/80">
              Política de Privacidade
            </Link>.
          </p>
        </section>

        <p className="text-xs text-muted-foreground text-center pt-4">
          Última atualização: {new Date().toLocaleDateString("pt-BR")}
        </p>
      </main>
    </div>
  );
}
