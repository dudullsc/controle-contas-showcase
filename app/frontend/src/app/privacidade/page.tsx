import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de Privacidade | Controle de Contas',
  description: 'Política de privacidade do Controle de Contas.',
};

export default function PrivacyPolicyPage() {
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
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
            Política de Privacidade
          </h1>
          <p className="mt-3 text-sm text-gray-500">Última atualização: 28 de agosto de 2026</p>
        </header>

        <div className="mt-8 max-w-none text-base leading-7 [&_a]:text-primary-600 [&_a]:underline-offset-2 [&_a:hover]:underline [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:leading-7 [&_h2]:text-gray-900 [&_p]:mb-4 [&_strong]:font-semibold [&_strong]:text-gray-800 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
          <p>
            Esta Política explica como o Controle de Contas,
            coleta, utiliza, armazena e protege informações pessoais quando você utiliza o sistema.
            Para dúvidas ou solicitações relacionadas à privacidade, entre em contato pelo e-mail{' '}
            <a href="mailto:contato@example.com">contato@example.com</a>.
          </p>

          <h2>1. Dados que podemos coletar</h2>
          <ul>
            <li>
              <strong>Cadastro:</strong> nome, e-mail, CPF, telefone, família, perfil de acesso e
              senha armazenada em formato protegido.
            </li>
            <li>
              <strong>Dados financeiros:</strong> despesas, receitas, dívidas, investimentos,
              salários, categorias, vencimentos, pagamentos e observações inseridas por você.
            </li>
            <li>
              <strong>Arquivos:</strong> comprovantes e outros documentos enviados ao sistema.
            </li>
            <li>
              <strong>Segurança e funcionamento:</strong> endereço IP, navegador, dispositivo,
              registros de acesso, tokens de notificações e informações técnicas necessárias para
              manter o serviço seguro.
            </li>
          </ul>

          <h2>2. Como usamos os dados</h2>
          <p>Usamos as informações para:</p>
          <ul>
            <li>criar e administrar sua conta e controlar permissões;</li>
            <li>registrar, organizar e apresentar seus dados financeiros;</li>
            <li>enviar alertas e mensagens solicitadas, inclusive por e-mail, WhatsApp ou push;</li>
            <li>processar recuperação de senha e validar a segurança dos acessos;</li>
            <li>executar rotinas de backup quando essa função estiver habilitada;</li>
            <li>corrigir falhas, prevenir abusos e cumprir obrigações legais.</li>
          </ul>

          <h2>3. Bases legais</h2>
          <p>
            O tratamento pode ocorrer para execução do serviço solicitado, cumprimento de obrigações
            legais, exercício regular de direitos, proteção da segurança da aplicação e, quando
            aplicável, com base no seu consentimento para recursos opcionais.
          </p>

          <h2>4. Compartilhamento e operadores</h2>
          <p>
            Não vendemos dados pessoais. Podemos utilizar prestadores de infraestrutura,
            armazenamento, envio de e-mails, notificações e segurança estritamente para operar o
            sistema. Quando você autoriza uma integração, os dados necessários podem ser enviados ao
            respectivo provedor. Esses provedores podem processar dados em outros países, conforme
            sua própria documentação e legislação aplicável.
          </p>

          <h2>5. Armazenamento e segurança</h2>
          <p>
            Aplicamos controles de acesso, autenticação, registro de eventos e medidas técnicas para
            reduzir riscos de acesso indevido, perda ou alteração. Nenhum serviço conectado à
            internet é completamente imune a incidentes. As informações são mantidas enquanto a
            conta estiver ativa ou pelo período necessário para cumprir finalidades legais,
            contratuais e de segurança. Backups seguem a configuração de retenção do sistema.
          </p>

          <h2>6. Cookies, armazenamento local e biometria</h2>
          <p>
            O sistema utiliza cookie de autenticação e armazenamento local para recursos como
            lembrar o e-mail. No aplicativo móvel, o login biométrico usa o cofre seguro do
            dispositivo para armazenar as credenciais; o Controle de Contas não recebe nem armazena
            a impressão digital ou o rosto utilizados pelo sistema operacional.
          </p>

          <h2>7. Seus direitos</h2>
          <p>
            Nos termos da legislação aplicável, você pode solicitar confirmação do tratamento,
            acesso, correção, atualização, anonimização, eliminação quando cabível, informação sobre
            compartilhamentos e revisão de consentimentos. Algumas solicitações podem ser limitadas
            por obrigação legal ou necessidade de preservação de registros. Envie seu pedido para{' '}
            <a href="mailto:contato@example.com">contato@example.com</a>.
          </p>

          <h2>8. Crianças e adolescentes</h2>
          <p>
            O serviço não é destinado a crianças. Caso identifiquemos coleta indevida de dados de
            uma criança, adotaremos medidas razoáveis para remover essas informações.
          </p>

          <h2>9. Alterações</h2>
          <p>
            Esta Política pode ser atualizada para refletir mudanças no serviço ou na legislação. A
            versão vigente estará disponível nesta página, com a data da última atualização.
          </p>
        </div>
      </article>
    </main>
  );
}
