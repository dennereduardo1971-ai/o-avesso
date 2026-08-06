// manual.js — Manual do Jogador. Só leitura, sem storage: as regras não mudam
// de aparelho pra aparelho, então não precisam de banco nenhum.

import { initPage } from './session.js';

await initPage({ escopo: 'compartilhado' });

document.getElementById('manual-root').innerHTML = `
  <div class="mn-wrap">
    <div class="mn-frame">
      <div class="mn-header">
        <p class="mn-eyebrow">O Avesso</p>
        <h1 class="mn-title">Manual do Jogador</h1>
        <p class="mn-tagline">"Do outro lado do espelho, tudo tem costura."</p>
      </div>

      <div class="mn-seam"></div>

      <section class="mn-section">
        <p class="mn-num">1</p>
        <h2>Premissa</h2>
        <p>Você é a <strong>Visitante</strong>. Uma noite, ao passar pelo <strong>Espelho de Moldura de Linha</strong>, na Mansão Brasswood, você atravessou para o <strong>Avesso</strong> — um mundo feito de tecidos, botões e porcelana, onde a lógica funciona quase certo, mas nunca por completo.</p>
        <p>Para voltar para casa, você precisa descobrir <strong>Três Verdades Esquecidas</strong>, escondidas dentro dos mistérios que o Avesso vai te apresentar. O primeiro deles já bate à sua porta: <strong>O Caso do Duque Desfiado</strong>.</p>
      </section>

      <section class="mn-section">
        <p class="mn-num">2</p>
        <h2>Filosofia do Jogo</h2>
        <p>Este não é um jogo de sorte. É um jogo de <strong>observação, dedução e coragem</strong>.</p>
        <div class="mn-callout">
          <strong>Regra de Ouro:</strong> nenhuma pista essencial de um mistério depende de um dado. Se a pista é necessária para o caso avançar, e você usar a ferramenta certa, no lugar certo — você a encontra. Sempre.
        </div>
        <p>O dado só entra quando existe <strong>risco real</strong>: quando o Avesso reage a você, quando o tempo aperta, ou quando sua própria mente pode falhar diante do absurdo. Fora isso, a investigação acontece na sua cabeça, não nos números.</p>
        <p>Essa é a diferença entre "jogar um detetive" e <strong>ser</strong> uma.</p>
      </section>

      <section class="mn-section">
        <p class="mn-num">3</p>
        <h2>Atributos</h2>
        <p>Você tem três atributos, cada um ligado a uma parte do seu kit de costura interior.</p>
        <table class="mn-table">
          <thead><tr><th>Atributo</th><th>Representa</th><th>Usado para</th></tr></thead>
          <tbody>
            <tr><td><strong>Agulha</strong></td><td>Precisão, percepção fina</td><td>Notar detalhes escondidos, mirar, agir com exatidão</td></tr>
            <tr><td><strong>Dedal</strong></td><td>Resistência, proteção</td><td>Suportar o ambiente, resistir a dor, cansaço, ameaças físicas</td></tr>
            <tr><td><strong>Linha</strong></td><td>Lógica, raciocínio</td><td>Validar teorias, resistir à loucura do Avesso, amarrar pistas</td></tr>
          </tbody>
        </table>
        <p>Cada atributo tem um valor de <strong>1 a 4</strong> (você e o mestre definem os valores iniciais juntos, na criação da personagem — isso fica registrado na <em>Ficha da Visitante</em>).</p>
      </section>

      <section class="mn-section aviso">
        <p class="mn-num">4</p>
        <h2>Linha da Lógica (Recurso Vital)</h2>
        <p>Sua <strong>Linha da Lógica</strong> começa em <strong>5 pontos</strong>. Ela representa o quanto da sua razão ainda está costurada à sua própria mente.</p>
        <p><strong>Quando você perde 1 ponto:</strong></p>
        <ul class="mn-list">
          <li>Você <strong>falha em um teste de lógica básica</strong> (uma dedução simples que deveria fechar, mas não fechou).</li>
          <li>Você é <strong>afetada pela loucura do Avesso</strong> e, naquele momento, fica <strong>sem conseguir agir</strong> — perde a cena, perde a vez, o Avesso continua sem você.</li>
        </ul>
        <p><strong>Se a Linha chegar a 0:</strong></p>
        <p>Você não morre. Algo pior acontece: <strong>você vira uma boneca</strong> — presa, consciente, mas incapaz de agir por conta própria, até que algo (ou alguém, dentro da ficção) a desamarre de volta.</p>
        <p><strong>Recuperando Linha:</strong></p>
        <ul class="mn-list">
          <li>Descobrir uma <strong>Verdade Esquecida</strong> recupera toda a sua Linha.</li>
          <li>Certos momentos de descanso narrativo (a critério do mestre) podem recuperar 1 ponto.</li>
        </ul>
      </section>

      <section class="mn-section">
        <p class="mn-num">5</p>
        <h2>Quando Rolar Dados</h2>
        <p>Você <strong>não</strong> rola dados para:</p>
        <ul class="mn-list">
          <li>Examinar uma cena</li>
          <li>Juntar pistas na sua cabeça</li>
          <li>Formular uma teoria</li>
          <li>Fazer perguntas, revisitar, conversar</li>
        </ul>
        <p>Você <strong>rola 1d6</strong> quando:</p>
        <table class="mn-table">
          <thead><tr><th>Situação</th><th>Atributo usado</th></tr></thead>
          <tbody>
            <tr><td>Precisa notar algo sutil, escondido ou disfarçado</td><td>Agulha</td></tr>
            <tr><td>Enfrenta algo fisicamente arriscado, doloroso ou desgastante</td><td>Dedal</td></tr>
            <tr><td>Precisa confirmar/validar uma teoria antes de agir sobre ela, ou resistir a um evento de loucura do Avesso</td><td>Linha</td></tr>
          </tbody>
        </table>
        <p><strong>Como rolar:</strong> 1d6 + valor do atributo.</p>
        <ul class="mn-list">
          <li><strong>6 ou mais:</strong> sucesso limpo.</li>
          <li><strong>4–5:</strong> sucesso, mas com um custo (o mestre narra uma complicação).</li>
          <li><strong>3 ou menos:</strong> falha — e, se for um teste de Linha, você perde 1 ponto de Linha da Lógica.</li>
        </ul>
      </section>

      <section class="mn-section pista">
        <p class="mn-num">6</p>
        <h2>Kit de Detetive</h2>
        <p>Cada ferramenta do seu kit responde a um <strong>tipo específico de pista</strong>. Nunca use uma ferramenta "no escuro" — pense em qual tipo de mistério está diante de você antes de escolher.</p>

        <div class="mn-kit-item">
          <p class="mn-kit-name">🔍 Lupa de Pedra Furada</p>
          <p><em>Para o que está pequeno demais ou escondido demais para ver a olho nu.</em> Revela detalhes físicos minúsculos: fibras, marcas, resíduos, texturas. Uso livre, sem teste — a menos que o detalhe esteja deliberadamente disfarçado (aí, teste de Agulha).</p>
        </div>
        <div class="mn-kit-item">
          <p class="mn-kit-name">⏳ Monóculo do Tempo</p>
          <p><em>Para o que já não está mais lá.</em> Mostra o "eco" recente de um lugar — o que aconteceu ali minutos ou horas atrás. Uso livre para cenas recentes; para ecos mais antigos ou apagados, teste de Linha.</p>
        </div>
        <div class="mn-kit-item">
          <p class="mn-kit-name">🪞 Mudança de Escala</p>
          <p><em>Para o que é grande demais, ou pequeno demais, pra ser entendido no tamanho errado.</em> Permite encolher ou ampliar sua perspectiva sobre um objeto ou ambiente, revelando estrutura, mecanismos internos, ou relações espaciais escondidas. Uso livre; risco físico ao usá-la (o próprio ato de mudar de escala é desgastante) pode pedir teste de Dedal.</p>
        </div>
        <div class="mn-kit-item">
          <p class="mn-kit-name">🎭 Dialética do Absurdo</p>
          <p><em>Para quando a lógica normal não serve.</em> Permite argumentar com a lógica do próprio Avesso — usar as regras nonsense do mundo a seu favor em vez de lutar contra elas. Ferramenta de último recurso: sempre exige teste de Linha, porque folhear a lógica do Avesso arrisca a sua própria.</p>
        </div>
      </section>

      <section class="mn-section aviso">
        <p class="mn-num">7</p>
        <h2>Loucura do Avesso</h2>
        <p>O Avesso não é hostil por natureza, mas é <strong>incoerente</strong>, e essa incoerência corrói quem tenta entendê-la com lógica normal.</p>
        <p>Em momentos determinados pela narrativa (nunca aleatórios — sempre ligados a uma cena específica), você fará um <strong>teste de Linha para resistir</strong>. Se falhar:</p>
        <ul class="mn-list">
          <li>Você perde 1 ponto de Linha da Lógica, <strong>e</strong></li>
          <li>Fica sem ação naquela cena — o Avesso segue em frente sem esperar por você.</li>
        </ul>
        <p>Isso nunca é punição gratuita: é sempre a consequência narrativa de encarar algo que desafia demais a razão.</p>
      </section>

      <section class="mn-section">
        <p class="mn-num">8</p>
        <h2>Estrutura de uma Investigação</h2>
        <p>Cada caso segue, livremente, quatro movimentos:</p>
        <ol class="mn-steps">
          <li><strong>Observar</strong> — a cena é descrita; você decide onde olhar.</li>
          <li><strong>Examinar</strong> — você escolhe uma ferramenta do kit ou uma pergunta direta.</li>
          <li><strong>Deduzir</strong> — você forma uma teoria, em voz alta ou por escrito, sem dado nenhum.</li>
          <li><strong>Agir</strong> — você testa sua teoria, confronta alguém, ou toma uma decisão irreversível. É aqui que o risco (e o dado) normalmente aparece.</li>
        </ol>
        <p>Você pode repetir observar/examinar/deduzir quantas vezes quiser. O dado só entra no momento de agir sob risco.</p>
      </section>

      <section class="mn-section pista">
        <p class="mn-num">9</p>
        <h2>O Caso do Duque Desfiado</h2>
        <p><em>Seu primeiro mistério no Avesso.</em></p>
        <p>O <strong>Duque de Porcelana</strong>, figura de destaque na sociedade local, foi encontrado em seus aposentos — trancados por dentro — com o recheio de lã azul <strong>arrancado do próprio corpo</strong>. Nenhuma entrada forçada. Nenhum suspeito óbvio. Nenhuma lã azul encontrada na cena.</p>
        <p>Um mistério de <strong>quarto fechado</strong>, no estilo mais clássico — mas no Avesso, "fechado" nem sempre significa o que parece.</p>
      </section>

      <p class="mn-closing">Bem-vinda ao Avesso. Aqui, tudo tem costura — inclusive você.</p>
    </div>
  </div>
`;
