type Diagram = { title: string; nodes: [string, string, string]; note: string };
export const sectionDiagrams: Record<string, Diagram[]> = {
  'ouro': [
    { title: 'Ciclo de uma temporada', nodes: ['Cidade: arrendar e investir', 'Campo: produzir e entregar', 'Balanço: decidir o próximo passo'], note: 'As decisões entre temporadas afetam o capital e as tecnologias da próxima operação.' },
    { title: 'Onde a produção pode parar', nodes: ['Bomba e tubos', 'Capacidade da torre', 'Frota e destino'], note: 'Ampliar apenas a extração não resolve um gargalo de transporte. Observe a capacidade de cada etapa.' }
  ],
  'fany': [
    { title: 'Do CEP à tarifa demonstrativa', nodes: ['CEP informado', 'ViaCEP identifica a UF', 'Banco consulta shipping_zones'], note: 'ViaCEP fornece endereço, não cotação. Uma integração real precisará validar serviço, preço e validade da cotação.' },
    { title: 'Confirmação com evidências', nodes: ['Validar assinatura', 'Consultar API do Mercado Pago', 'Conferir pedido, moeda e valor'], note: 'O corpo da notificação sozinho não autoriza marcar um pedido como pago.' }
  ],
  'ponto': [
    { title: 'Sincronizar sem sobrescrever às cegas', nodes: ['Revisão local esperada', 'Comparação com a nuvem', 'Salvar ou pedir escolha'], note: 'Se outra cópia avançou, o conflito exige uma decisão explícita; a sincronização é opcional.' },
    { title: 'Aplicação estática, dados locais', nodes: ['Astro entrega a interface', 'JavaScript gerencia os registros', 'Supabase é uma opção'], note: 'O pré-cache permite uso offline depois do carregamento dos recursos necessários.' }
  ],
  'hub': [
    { title: 'Estoque não é um único número', nodes: ['Saldo informado', 'Reservas e margem de segurança', 'Quantidade publicável'], note: 'A quantidade anunciada precisa considerar o que já está comprometido e os limites da operação.' },
    { title: 'Da receita ao resultado', nodes: ['Valor vendido', 'Custos, taxas e frete', 'Margem do pedido'], note: 'Uma venda com faturamento alto pode deixar uma margem pequena. O resultado depende dos custos envolvidos.' }
  ],
  'welcome': [
    { title: 'Escolha seu caminho', nodes: ['Projetos: veja a aplicação', 'Tutoriais: pratique os conceitos', 'IA: avalie usos e limites'], note: 'São caminhos complementares para aprender no Console do Jeff, não etapas obrigatórias.' },
    { title: 'Do artigo à experiência', nodes: ['Leia e explore o código', 'Experimente no seu contexto', 'Compartilhe uma sugestão'], note: 'O aprendizado continua quando você testa as ideias e identifica o que pode melhorar.' }
  ],
  'ia': [
    { title: 'Assistência com verificação', nodes: ['Contexto e instrução', 'Proposta da ferramenta', 'Teste no projeto real'], note: 'Explicações e rascunhos ajudam, mas o resultado precisa corresponder ao que você está construindo.' },
    { title: 'Quando a resposta parece boa demais', nodes: ['Afirmação convincente', 'Fonte ou teste independente', 'Aceitar, ajustar ou descartar'], note: 'Confiança no tom da resposta não substitui evidência de que ela está correta.' }
  ],
  'limits': [
    { title: 'A dívida de verificação', nodes: ['Mais código gerado', 'Mais comportamento para conferir', 'Revisão e testes necessários'], note: 'Produzir rápido não elimina o trabalho de demonstrar correção e manter o sistema.' },
    { title: 'Ciclo de trabalho verificável', nodes: ['Requisito pequeno e claro', 'Mudança com teste objetivo', 'Revisão antes de integrar'], note: 'Lotes menores tornam mais fácil perceber regressões e investigar resultados inesperados.' }
  ],
  'models': [
    { title: 'Revisão por IA não é prova', nodes: ['Primeira IA gera', 'Outra IA comenta', 'Teste independente decide'], note: 'Modelos podem compartilhar enganos. Uma segunda opinião ainda precisa de evidência.' },
    { title: 'Escolha para a sua tarefa', nodes: ['Mesmo problema e contexto', 'Correção e esforço de revisão', 'Custo e tempo aceitáveis'], note: 'O melhor resultado depende do trabalho que você precisa fazer, não apenas da posição em um ranking.' }
  ],
  'react': [
    { title: 'Props descem pela árvore', nodes: ['Componente pai', 'Props com dados e callbacks', 'Componente filho'], note: 'O filho recebe informações; um callback pode comunicar uma interação ao pai.' },
    { title: 'Estado dirige a interface', nodes: ['Usuário dispara evento', 'Setter agenda novo estado', 'React renderiza a atualização'], note: 'Atualize o estado pela API do React, sem alterar diretamente o valor existente.' }
  ],
  'typescript': [
    { title: 'Preparar o ambiente', nodes: ['Instalar dependências', 'Definir tsconfig', 'Executar scripts npm'], note: 'Configuração de módulos, alvo e ferramentas precisa combinar com o ambiente onde o código roda.' },
    { title: 'Entrada externa não vem tipada', nodes: ['Dados desconhecidos', 'Validação em execução', 'Valor seguro para o código'], note: 'Uma asserção de tipo não valida JSON. Tipos ajudam no editor; entradas externas exigem verificações reais.' }
  ],
  'financas': [
    { title: 'O ciclo local', nodes: ['Interface registra', 'Domínio calcula', 'IndexedDB persiste'], note: 'Não há servidor no caminho. Se o dispositivo perde a internet, o fluxo continua igual.' },
    { title: 'O que a IA pode fazer', nodes: ['Motor calcula', 'Contexto validado', 'IA opcional explica'], note: 'A IA online apenas explica o que o motor local já calculou. Sem backend, o assistente funciona localmente.' }
  ]
};
