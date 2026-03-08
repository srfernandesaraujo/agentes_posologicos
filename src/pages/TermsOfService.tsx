import { Link } from "react-router-dom";
import { Pill, ArrowLeft } from "lucide-react";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-[hsl(220,25%,5%)] text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[hsl(220,25%,5%)]/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
              <Pill className="h-4 w-4 text-white" />
            </div>
            <span className="font-display text-lg font-bold">Agentes Posológicos</span>
          </Link>
        </div>
      </header>

      <div className="container max-w-3xl py-12">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-white/40 hover:text-white/70 transition-colors mb-8">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao início
        </Link>

        <h1 className="font-display text-3xl font-bold mb-2">Termos de Serviço</h1>
        <p className="text-sm text-white/40 mb-10">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>

        <div className="space-y-8 text-white/70 leading-relaxed">
          <section>
            <h2 className="font-display text-xl font-semibold text-white mb-3">1. Aceitação dos Termos</h2>
            <p>Ao acessar e utilizar a plataforma Agentes Posológicos ("Plataforma"), você concorda com estes Termos de Serviço. Se não concordar com qualquer parte destes termos, não utilize a Plataforma.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-white mb-3">2. Descrição do Serviço</h2>
            <p>A Plataforma oferece acesso a agentes de inteligência artificial especializados nas áreas de saúde, educação, pesquisa acadêmica e produção de conteúdo. Os serviços incluem agentes pré-configurados, criação de agentes personalizados, salas virtuais colaborativas, marketplace de agentes e integração com WhatsApp.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-white mb-3">3. Cadastro e Conta</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Você deve fornecer informações verdadeiras e completas ao criar sua conta.</li>
              <li>Você é responsável por manter a confidencialidade de suas credenciais de acesso.</li>
              <li>Cada pessoa pode manter apenas uma conta ativa na Plataforma.</li>
              <li>Menores de 18 anos devem ter autorização dos pais ou responsáveis legais.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-white mb-3">4. Sistema de Créditos e Pagamentos</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>A utilização dos agentes requer créditos, que podem ser adquiridos via pacotes avulsos ou assinaturas mensais.</li>
              <li>Os créditos não são reembolsáveis, exceto quando exigido por lei.</li>
              <li>Os preços podem ser alterados mediante aviso prévio de 30 dias.</li>
              <li>Assinaturas são renovadas automaticamente, podendo ser canceladas a qualquer momento pelo portal do cliente.</li>
              <li>Créditos de boas-vindas são oferecidos uma única vez por usuário e não possuem valor monetário.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-white mb-3">5. Uso Aceitável</h2>
            <p className="mb-2">Ao utilizar a Plataforma, você concorda em NÃO:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Utilizar as respostas dos agentes como substituição de consultoria médica, farmacêutica ou jurídica profissional.</li>
              <li>Compartilhar informações pessoais de pacientes que possam identificá-los (dados sensíveis devem ser anonimizados).</li>
              <li>Tentar manipular, hackear ou abusar do sistema de créditos.</li>
              <li>Utilizar a Plataforma para gerar conteúdo ilegal, prejudicial ou que viole direitos de terceiros.</li>
              <li>Revender acesso à Plataforma sem autorização expressa.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-white mb-3">6. Limitação de Responsabilidade</h2>
            <p>A Plataforma utiliza modelos de inteligência artificial que podem gerar informações imprecisas ou incompletas. As respostas dos agentes são fornecidas como auxílio e <strong className="text-white">não substituem o julgamento profissional</strong>. A Plataforma não se responsabiliza por decisões clínicas, acadêmicas ou profissionais tomadas com base nas respostas geradas.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-white mb-3">7. Propriedade Intelectual</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>O conteúdo gerado pelos agentes pode ser utilizado livremente pelo usuário.</li>
              <li>Agentes personalizados criados por você permanecem de sua propriedade.</li>
              <li>A marca, design e código-fonte da Plataforma são propriedade de Posologia Produções.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-white mb-3">8. Marketplace</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Ao publicar um agente no Marketplace, você garante que possui os direitos sobre o conteúdo do system prompt.</li>
              <li>A Plataforma reserva-se o direito de remover agentes que violem estes termos ou que contenham conteúdo inadequado.</li>
              <li>Os créditos recebidos por vendas no Marketplace são adicionados ao saldo do criador conforme a política vigente.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-white mb-3">9. Modificações</h2>
            <p>Reservamo-nos o direito de modificar estes Termos a qualquer momento. Alterações significativas serão comunicadas por e-mail ou notificação na Plataforma com antecedência mínima de 15 dias.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-white mb-3">10. Contato</h2>
            <p>Para dúvidas sobre estes Termos, entre em contato pelo e-mail: <a href="mailto:sergio.araujo@ufrn.br" className="text-[hsl(199,89%,48%)] hover:underline">sergio.araujo@ufrn.br</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
