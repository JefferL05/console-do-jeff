/**
 * Theme Toggle Script
 * 
 * Este script gerencia o tema dark/light do site.
 * Ele:
 * 1. Verifica se há um tema salvo no localStorage
 * 2. Se não houver, usa a preferência do sistema
 * 3. Aplica a classe 'dark' no elemento HTML
 * 4. Escuta mudanças na preferência do sistema
 */

(function() {
  // Elementos do DOM
  const sunIcon = document.getElementById('sun-icon');
  const moonIcon = document.getElementById('moon-icon');
  
  /**
   * Atualiza os ícones de acordo com o tema
   */
  function updateIcons(isDark) {
    if (sunIcon && moonIcon) {
      if (isDark) {
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
      } else {
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
      }
    }
  }
  
  /**
   * Inicializa o tema ao carregar a página
   * Executa imediatamente para evitar flash de conteúdo
   */
  function initTheme() {
    let theme = 'light';
    
    // Verifica localStorage primeiro
    if (typeof localStorage !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'dark' || savedTheme === 'light') {
        theme = savedTheme;
      } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        // Se não há tema salvo, usa preferência do sistema
        theme = 'dark';
      }
    }
    
    // Aplica o tema
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    updateIcons(theme === 'dark');
  }
  
  // Executa imediatamente
  initTheme();
  
  // Adiciona event listener ao botão de toggle
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', function() {
      const isDark = document.documentElement.classList.toggle('dark');
      
      // Salva a preferência
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      
      // Atualiza ícones
      updateIcons(isDark);
    });
  }
  
  // Escuta mudanças na preferência do sistema (se não houver tema salvo manualmente)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
    // Só atualiza se não houver tema salvo no localStorage
    if (!localStorage.getItem('theme')) {
      if (e.matches) {
        document.documentElement.classList.add('dark');
        updateIcons(true);
      } else {
        document.documentElement.classList.remove('dark');
        updateIcons(false);
      }
    }
  });
})();
