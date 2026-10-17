export type VisualGuide = {
  title: string;
  caption: string;
  takeaways: string[];
  steps: { label: string; detail: string; icon: 'code' | 'database' | 'check' | 'chart' | 'compass' | 'cloud' | 'layers' | 'truck' }[];
};

export const visualGuides: Record<string, VisualGuide> = {
  'ouro-do-subsolo-jogo-gestao': {
    title: 'Da reserva à receita', caption: 'O petróleo só vira receita quando chega ao mercado. Cada etapa pode limitar a operação.',
    takeaways: ['Expedições de três ou cinco minutos para experimentar estratégias.', 'Campanha com dez temporadas, investimentos e disputa pela cidade.', 'Produção, transporte e preço precisam funcionar juntos.'],
    steps: [
      { label: 'Explorar', detail: 'Localize reservas antes de investir.', icon: 'compass' },
      { label: 'Extrair', detail: 'Torres e tubos dividem a capacidade.', icon: 'layers' },
      { label: 'Transportar', detail: 'A frota leva cargas ao destino.', icon: 'truck' },
      { label: 'Vender', detail: 'Compare preços e o tempo restante.', icon: 'chart' }
    ]
  },
  'fany-cosmeticos-loja-nextjs-supabase': {
    title: 'Quem decide o valor do pedido?', caption: 'O cliente escolhe os itens; o servidor calcula e verifica. O pagamento permanece em sandbox.',
    takeaways: ['O carrinho envia identificadores e quantidades, não o preço definitivo.', 'Políticas de acesso separam clientes e administradores.', 'Frete real, estoque reservado e validação comercial ainda são próximos passos.'],
    steps: [
      { label: 'Carrinho', detail: 'Itens e quantidades no navegador.', icon: 'code' },
      { label: 'Banco', detail: 'Calcula preços, frete e total.', icon: 'database' },
      { label: 'Gateway', detail: 'Cria o pagamento de teste.', icon: 'cloud' },
      { label: 'Conferência', detail: 'Assinatura, referência, moeda e valor.', icon: 'check' }
    ]
  },
  'meu-ponto-3-controle-jornada': {
    title: 'Sua jornada, do registro ao relatório', caption: 'Os dados ficam locais primeiro. A nuvem é opcional e conflitos de sincronização exigem uma escolha.',
    takeaways: ['Empregos diferentes têm registros e regras próprios.', 'Turnos noturnos e períodos precisam de validação.', 'Backup e revisão ajudam a preservar os registros.'],
    steps: [
      { label: 'Registrar', detail: 'Entrada, saída e marcadores.', icon: 'code' },
      { label: 'Calcular', detail: 'Jornada, regras e banco de horas.', icon: 'layers' },
      { label: 'Consultar', detail: 'Histórico, totais e exportação.', icon: 'chart' },
      { label: 'Sincronizar', detail: 'Opcional, com revisão por conta.', icon: 'cloud' }
    ]
  },
  'ml-supplier-hub-arquitetura': {
    title: 'Uma operação conectada', caption: 'Visão simplificada das relações do projeto: estoque e custos precisam acompanhar os pedidos.',
    takeaways: ['Um monólito modular organiza responsabilidades dentro da mesma aplicação.', 'Disponibilidade, reserva e margem de segurança são conceitos diferentes.', 'Faturamento sozinho não mostra quanto sobra da venda.'],
    steps: [
      { label: 'Fornecedores', detail: 'Origem, custo e disponibilidade.', icon: 'layers' },
      { label: 'Estoque', detail: 'Saldo e quantidade publicável.', icon: 'database' },
      { label: 'Pedidos', detail: 'Separação e preparação do envio.', icon: 'truck' },
      { label: 'Margem', detail: 'Receita menos custos da operação.', icon: 'chart' }
    ]
  },
  'bem-vindo': {
    title: 'Aprender construindo', caption: 'O Console do Jeff registra projetos, decisões e aprendizados que podem ajudar outras pessoas.',
    takeaways: ['Aplicações reais dão contexto aos conceitos.', 'Artigos técnicos explicam escolhas e problemas encontrados.', 'Compartilhar também é uma forma de aprender.'],
    steps: [
      { label: 'Explorar', detail: 'Escolher um problema ou tecnologia.', icon: 'compass' },
      { label: 'Construir', detail: 'Experimentar com código.', icon: 'code' },
      { label: 'Verificar', detail: 'Entender resultados e limitações.', icon: 'check' },
      { label: 'Compartilhar', detail: 'Registrar o aprendizado no blog.', icon: 'cloud' }
    ]
  },
  'ia-para-desenvolvedores': {
    title: 'IA como parte do trabalho', caption: 'Uma proposta pode acelerar a tarefa. Contexto e validação continuam necessários para aceitar o resultado.',
    takeaways: ['Assistência na escrita e explicação de código pode ser útil.', 'Respostas convincentes ainda podem estar erradas.', 'Avalie o resultado no contexto do seu projeto.'],
    steps: [
      { label: 'Definir', detail: 'Explique a tarefa e as restrições.', icon: 'compass' },
      { label: 'Gerar', detail: 'Use a IA para uma proposta inicial.', icon: 'code' },
      { label: 'Revisar', detail: 'Confira comportamento e fontes.', icon: 'check' },
      { label: 'Aplicar', detail: 'Integre o que foi validado.', icon: 'layers' }
    ]
  },
  'limites-das-llms-na-programacao': {
    title: 'Parece certo. Mas funciona?', caption: 'Gerar código e demonstrar que ele atende ao requisito são trabalhos diferentes.',
    takeaways: ['A aparência profissional do código não comprova correção.', 'Quanto mais se gera sem revisar, maior pode ser a dívida de verificação.', 'Testes e julgamento humano ajudam a reduzir a distância entre proposta e resultado.'],
    steps: [
      { label: 'Requisito', detail: 'Descreva o resultado esperado.', icon: 'compass' },
      { label: 'Proposta', detail: 'A LLM produz uma implementação.', icon: 'code' },
      { label: 'Evidência', detail: 'Teste casos reais e condições-limite.', icon: 'check' },
      { label: 'Decisão', detail: 'Aceite, ajuste ou descarte.', icon: 'layers' }
    ]
  },
  'qual-ia-melhor-para-programar': {
    title: 'Além do nome do modelo', caption: 'Uma escolha útil considera a tarefa e o processo, não apenas um ranking.',
    takeaways: ['Compare modelos usando problemas relevantes para você.', 'Revisão por outra IA não elimina a necessidade de verificação.', 'Complexidade desnecessária e falhas de segurança precisam ser avaliadas.'],
    steps: [
      { label: 'Contexto', detail: 'Requisitos, ambiente e restrições.', icon: 'compass' },
      { label: 'Experimento', detail: 'Uma tarefa comparável entre modelos.', icon: 'code' },
      { label: 'Revisão', detail: 'Correção, clareza e segurança.', icon: 'check' },
      { label: 'Escolha', detail: 'Utilidade, custo e esforço de revisão.', icon: 'chart' }
    ]
  },
  'react-guia-2026': {
    title: 'Como uma interface reage', caption: 'Modelo mental simplificado: eventos atualizam o estado, e React calcula a interface correspondente.',
    takeaways: ['Componentes organizam partes reutilizáveis da interface.', 'Props passam informações; estado representa dados que mudam.', 'Efeitos sincronizam com sistemas externos quando necessário.'],
    steps: [
      { label: 'Props', detail: 'Dados recebidos pelo componente.', icon: 'layers' },
      { label: 'Estado', detail: 'Dados que mudam na interação.', icon: 'database' },
      { label: 'Renderização', detail: 'Interface calculada a partir dos dados.', icon: 'code' },
      { label: 'Interação', detail: 'Eventos podem atualizar o estado.', icon: 'compass' }
    ]
  },
  'typescript-nodejs-setup': {
    title: 'Do tipo à execução', caption: 'Tipos ajudam no desenvolvimento, mas dados externos também precisam de validação em tempo de execução.',
    takeaways: ['Uma configuração consistente torna os erros mais visíveis.', 'Tipos descrevem contratos entre partes do código.', 'Verificação estática não substitui testes e validação de entradas.'],
    steps: [
      { label: 'Configurar', detail: 'Dependências, tsconfig e scripts.', icon: 'layers' },
      { label: 'Tipar', detail: 'Modele dados e contratos.', icon: 'code' },
      { label: 'Verificar', detail: 'Execute o verificador de tipos.', icon: 'check' },
      { label: 'Executar', detail: 'Teste a aplicação no Node.js.', icon: 'compass' }
    ]
  },
  'projeto-financas-gestao-local': {
    title: 'Seus dados, no seu dispositivo', caption: 'A fonte verdadeira é o IndexedDB local. A interface lê, o domínio calcula e o Service Worker mantém o app disponível offline.',
    takeaways: ['Sem backend obrigatório: os dados ficam no navegador.', 'Transferências gravam as duas movimentações na mesma transação.', 'A IA é opcional e nunca substitui os cálculos locais.'],
    steps: [
      { label: 'Interface', detail: 'Dashboard, contas e assistente.', icon: 'code' },
      { label: 'Domínio', detail: 'Cálculos determinísticos locais.', icon: 'database' },
      { label: 'IndexedDB', detail: 'Transações atômicas e índices.', icon: 'layers' },
      { label: 'PWA', detail: 'Cache offline e backup manual.', icon: 'cloud' }
    ]
  }
};
