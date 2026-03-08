import { Link } from "react-router-dom";
import { Pill, ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
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

        <h1 className="font-display text-3xl font-bold mb-2">Política de Privacidade</h1>
        <p className="text-sm text-white/40 mb-10">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>

        <div className="space-y-8 text-white/70 leading-relaxed">
          <section>
            <h2 className="font-display text-xl font-semibold text-white mb-3">1. Informações Coletadas</h2>
            <p className="mb-3">Coletamos as seguintes informações:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-white/90">Dados de cadastro:</strong> Nome, endereço de e-mail e foto de perfil (opcional).</li>
              <li><strong className="text-white/90">Dados de uso:</strong> Interações com agentes, histórico de conversas, templates salvos e preferências.</li>
              <li><strong className="text-white/90">Dados de pagamento:</strong> Processados diretamente pelo Stripe. Não armazenamos dados de cartão de crédito.</li>
              <li><strong className="text-white/90">Dados técnicos:</strong> Endereço IP, tipo de navegador, sistema operacional e dados de acesso para fins de segurança.</li>
              <li><strong className="text-white/90">Chaves de API:</strong> Armazenadas de forma criptografada no banco de dados, utilizadas exclusivamente para processar solicitações aos provedores de IA.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-white mb-3">2. Uso das Informações</h2>
            <p className="mb-3">Utilizamos suas informações para:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Fornecer e manter os serviços da Plataforma.</li>
              <li>Processar pagamentos e gerenciar sua assinatura.</li>
              <li>Personalizar sua experiência e melhorar os agentes.</li>
              <li>Enviar notificações relevantes sobre o serviço (ex: monitor PubMed).</li>
              <li>Garantir a segurança e integridade da Plataforma.</li>
              <li>Cumprir obrigações legais aplicáveis.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-white mb-3">3. Conversas e Conteúdo Gerado</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Suas conversas com os agentes são armazenadas de forma segura e associadas à sua conta.</li>
              <li>O conteúdo das conversas é utilizado exclusivamente para manter o histórico e o contexto da conversa.</li>
              <li><strong className="text-white/90">Não utilizamos o conteúdo das suas conversas para treinar modelos de IA.</strong></li>
              <li>Em salas virtuais, as conversas são visíveis para o proprietário da sala e demais participantes.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-white mb-3">4. Compartilhamento de Dados</h2>
            <p className="mb-3">Compartilhamos dados apenas com:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-white/90">Provedores de IA</strong> (OpenAI, Google, Anthropic, etc.) — Apenas o conteúdo da conversa é enviado, sem dados pessoais identificáveis.</li>
              <li><strong className="text-white/90">Stripe</strong> — Para processamento de pagamentos.</li>
              <li><strong className="text-white/90">Supabase</strong> — Para hospedagem e armazenamento de dados.</li>
              <li><strong className="text-white/90">Resend</strong> — Para envio de e-mails transacionais.</li>
            </ul>
            <p className="mt-3">Não vendemos, alugamos ou compartilhamos seus dados pessoais com terceiros para fins de marketing.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-white mb-3">5. Segurança dos Dados</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Utilizamos criptografia para armazenar chaves de API e dados sensíveis.</li>
              <li>O acesso ao banco de dados é protegido por políticas de segurança em nível de linha (Row-Level Security).</li>
              <li>As comunicações são protegidas por HTTPS/TLS.</li>
              <li>Realizamos backups periódicos dos dados.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-white mb-3">6. Seus Direitos (LGPD)</h2>
            <p className="mb-3">Em conformidade com a Lei Geral de Proteção de Dados (LGPD), você tem direito a:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-white/90">Acesso:</strong> Solicitar informações sobre quais dados pessoais possuímos.</li>
              <li><strong className="text-white/90">Correção:</strong> Solicitar a correção de dados incompletos ou desatualizados.</li>
              <li><strong className="text-white/90">Exclusão:</strong> Solicitar a exclusão dos seus dados pessoais.</li>
              <li><strong className="text-white/90">Portabilidade:</strong> Solicitar a transferência dos seus dados a outro provedor.</li>
              <li><strong className="text-white/90">Revogação do consentimento:</strong> Retirar seu consentimento a qualquer momento.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-white mb-3">7. Retenção de Dados</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Dados da conta são mantidos enquanto a conta estiver ativa.</li>
              <li>Após exclusão da conta, os dados são removidos em até 30 dias.</li>
              <li>Dados de pagamento são retidos conforme exigência fiscal (5 anos).</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-white mb-3">8. Cookies</h2>
            <p>Utilizamos cookies e armazenamento local do navegador exclusivamente para manter sua sessão de autenticação e preferências de idioma. Não utilizamos cookies de rastreamento ou publicidade.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-white mb-3">9. Alterações nesta Política</h2>
            <p>Podemos atualizar esta Política de Privacidade periodicamente. Alterações significativas serão comunicadas por e-mail ou notificação na Plataforma.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-white mb-3">10. Contato do Encarregado (DPO)</h2>
            <p>Para exercer seus direitos ou tirar dúvidas sobre privacidade, entre em contato:</p>
            <p className="mt-2">
              <strong className="text-white/90">E-mail:</strong>{" "}
              <a href="mailto:sergio.araujo@ufrn.br" className="text-[hsl(199,89%,48%)] hover:underline">sergio.araujo@ufrn.br</a>
            </p>
            <p><strong className="text-white/90">Responsável:</strong> Sérgio Araújo — Posologia Produções</p>
          </section>
        </div>
      </div>
    </div>
  );
}
