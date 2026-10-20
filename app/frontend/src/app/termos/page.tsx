import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Termos de Uso | Controle de Contas',
  description: 'Termos de uso do Controle de Contas.',
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-gray-700 sm:px-6 sm:py-12">
      <article className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-10">
        <Link href="/login" className="text-sm font-medium text-primary-600 hover:text-primary-700">
          ← Voltar para o login
        </Link>

        <header className="mt-8 border-b border-gray-200 pb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">
            Controle de Contas
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">Termos de Uso</h1>
          <p className="mt-3 text-sm text-gray-500">Última atualização: 28 de agosto de 2026</p>
        </header>

        <div className="mt-8 max-w-none text-base leading-7 [&_a]:text-primary-600 [&_a]:underline-offset-2 [&_a:hover]:underline [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:leading-7 [&_h2]:text-gray-900 [&_p]:mb-4 [&_strong]:font-semibold [&_strong]:text-gray-800 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
          <p>
            Estes Termos regulam o uso do Controle de Contas. Ao
            criar uma conta ou utilizar o sistema, você declara que leu e aceita estas condições. Se
            não concordar com elas, não utilize o serviço.
          </p>

          <h2>1. O serviço</h2>
          <p>
            O Controle de Contas oferece ferramentas para organizar informações financeiras
            pessoais, acompanhar lançamentos, gerar relatórios e, quando habilitado, enviar
            notificações e realizar backups. O serviço pode receber atualizações, alterações ou
            indisponibilidades temporárias para manutenção e segurança.
          </p>

          <h2>2. Conta e responsabilidades</h2>
          <ul>
            <li>forneça informações verdadeiras, atuais e de sua responsabilidade;</li>
            <li>mantenha sua senha em sigilo e comunique acessos não autorizados;</li>
            <li>não compartilhe sua conta nem permita uso por pessoas não autorizadas;</li>
            <li>use os dados e recursos de acordo com a legislação aplicável;</li>
            <li>confira os lançamentos e mantenha cópias próprias das informações importantes.</li>
          </ul>

          <h2>3. Dados financeiros e decisões</h2>
          <p>
            Relatórios, previsões, médias e simuladores são ferramentas de apoio e não constituem
            aconselhamento financeiro, contábil, jurídico ou de investimentos. Você é responsável
            por conferir os dados inseridos e por qualquer decisão tomada a partir das informações
            apresentadas pelo sistema.
          </p>

          <h2>4. Conteúdo do usuário</h2>
          <p>
            Você mantém a responsabilidade pelos dados, textos e arquivos que inserir. Ao utilizar o
            serviço, concede apenas a autorização técnica necessária para armazenar, processar e
            exibir esse conteúdo dentro das funcionalidades escolhidas. Não envie conteúdo ilícito,
            fraudulento, malicioso ou que viole direitos de terceiros.
          </p>

          <h2>5. Integrações e backups</h2>
          <p>
            Integrações com e-mail, WhatsApp, notificações push e outros serviços dependem da
            disponibilidade e das regras dos respectivos provedores. Backups são uma camada
            adicional de proteção e não substituem cópias independentes. O usuário deve verificar
            periodicamente se os backups estão sendo concluídos.
          </p>

          <h2>6. Uso proibido</h2>
          <p>
            É proibido tentar acessar contas ou dados de terceiros, explorar vulnerabilidades,
            interromper o funcionamento do sistema, automatizar requisições abusivas, distribuir
            malware ou utilizar o serviço para finalidade ilegal.
          </p>

          <h2>7. Suspensão e encerramento</h2>
          <p>
            Podemos suspender ou encerrar o acesso quando houver violação destes Termos, risco à
            segurança, exigência legal ou uso que prejudique o serviço e seus usuários. Você pode
            solicitar o encerramento da conta pelo canal de contato disponível.
          </p>

          <h2>8. Limitação de responsabilidade</h2>
          <p>
            Empregamos esforços razoáveis para manter o serviço disponível e seguro, mas não
            garantimos funcionamento ininterrupto ou ausência de falhas. Na extensão permitida pela
            lei, não somos responsáveis por indisponibilidade de provedores terceiros, informações
            incorretas inseridas pelo usuário, decisões financeiras ou perdas decorrentes da
            ausência de cópias independentes.
          </p>

          <h2>9. Propriedade intelectual</h2>
          <p>
            A aplicação, sua identidade visual, código, textos e componentes próprios são protegidos
            pela legislação aplicável. Estes Termos não transferem ao usuário qualquer direito sobre
            esses elementos, salvo a licença limitada de uso do serviço.
          </p>

          <h2>10. Alterações e legislação</h2>
          <p>
            Podemos atualizar estes Termos para refletir mudanças no serviço ou na legislação. A
            versão vigente ficará disponível nesta página. Estes Termos são interpretados de acordo
            com as leis brasileiras, respeitados os direitos previstos na legislação de proteção do
            consumidor e de proteção de dados.
          </p>

          <h2>11. Contato</h2>
          <p>
            Para dúvidas sobre estes Termos, entre em contato pelo e-mail{' '}
            <a href="mailto:contato@example.com">contato@example.com</a>.
          </p>
        </div>
      </article>
    </main>
  );
}
