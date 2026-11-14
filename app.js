/**
 * TaskFlow - Zen Productivity To-Do Application
 * Complete modern client-side application logic
 */

(function () {
  'use strict';

  // --- Initial Default Sample Data ---
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const DEFAULT_CATEGORIES = ['Work', 'Personal', 'Shopping', 'Health', 'Learning'];

  const DEFAULT_TASKS = [
    {
      id: 'task-1',
      title: 'Review quarterly project roadmap & design deck',
      notes: 'Finalize milestones for Q1 launch and check wireframes with the UX team.',
      dueDate: todayStr,
      priority: 'high',
      category: 'Work',
      completed: false,
      completedAt: null,
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      starred: true,
      subtasks: [
        { id: 'sub-1', text: 'Gather feedback from marketing', completed: true },
        { id: 'sub-2', text: 'Update timeline diagram', completed: false },
        { id: 'sub-3', text: 'Share slides in Slack', completed: false }
      ]
    },
    {
      id: 'task-2',
      title: '30-minute cardio workout & stretch',
      notes: 'Focus on mobility and hydration.',
      dueDate: todayStr,
      priority: 'medium',
      category: 'Health',
      completed: true,
      completedAt: new Date(Date.now() - 1800000).toISOString(),
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      starred: false,
      subtasks: []
    },
    {
      id: 'task-3',
      title: 'Pick up organic groceries for meal prep',
      notes: 'Spinach, olive oil, Greek yogurt, berries, almonds.',
      dueDate: todayStr,
      priority: 'low',
      category: 'Shopping',
      completed: false,
      completedAt: null,
      createdAt: new Date(Date.now() - 10000000).toISOString(),
      starred: false,
      subtasks: [
        { id: 'sub-4', text: 'Almonds and seeds', completed: true },
        { id: 'sub-5', text: 'Greek yogurt & berries', completed: false }
      ]
    },
    {
      id: 'task-4',
      title: 'Finish Chapter 4 of System Design Handbook',
      notes: 'Read up on event sourcing and CQRS architecture patterns.',
      dueDate: tomorrowStr,
      priority: 'high',
      category: 'Learning',
      completed: false,
      completedAt: null,
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      starred: true,
      subtasks: []
    },
    {
      id: 'task-5',
      title: 'Organize desk setup and cable management',
      notes: 'Clean monitor screen and route headphone cable under desk.',
      dueDate: yesterdayStr,
      priority: 'low',
      category: 'Personal',
      completed: false,
      completedAt: null,
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      starred: false,
      subtasks: []
    }
  ];

  // --- State ---
  let state = {
    tasks: [],
    categories: [],
    currentView: 'inbox', // 'inbox', 'today', 'upcoming', 'starred', 'completed', 'category:Name', 'priority:high'
    currentStatusFilter: 'all', // 'all', 'active', 'completed'
    currentSort: 'created-desc',
    searchQuery: '',
    expandedTaskId: null,
    soundEnabled: true,
    theme: 'light',
    pomodoro: {
      duration: 1500, // 25 min in seconds
      remaining: 1500,
      isRunning: false,
      timerId: null,
      mode: 'focus', // 'focus', 'short', 'long'
      activeTaskId: null,
      completedCount: 0,
      totalFocusSeconds: 0
    }
  };

  // --- Audio Synthesizer (Web Audio API) ---
  const AudioEngine = {
    ctx: null,
    init() {
      if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
    },
    playTone(freq, duration, type = 'sine', startTime = 0) {
      if (!state.soundEnabled) return;
      try {
        this.init();
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + startTime);
        gain.gain.setValueAtTime(0.08, this.ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + startTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + startTime);
        osc.stop(this.ctx.currentTime + startTime + duration);
      } catch (e) {
        // Audio might be blocked by autoplay policies
      }
    },
    playComplete() {
      this.playTone(523.25, 0.12, 'sine', 0); // C5
      this.playTone(659.25, 0.14, 'sine', 0.08); // E5
      this.playTone(783.99, 0.22, 'sine', 0.16); // G5
    },
    playUncheck() {
      this.playTone(440, 0.1, 'sine', 0);
      this.playTone(349.23, 0.14, 'sine', 0.06);
    },
    playTimerChime() {
      this.playTone(587.33, 0.2, 'triangle', 0);
      this.playTone(880, 0.35, 'triangle', 0.15);
      this.playTone(1046.50, 0.5, 'triangle', 0.3);
    }
  };

  // --- Confetti Canvas Engine ---
  const Confetti = {
    canvas: null,
    ctx: null,
    particles: [],
    animationId: null,

    init() {
      this.canvas = document.getElementById('confetti-canvas');
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');
      this.resize();
      window.addEventListener('resize', () => this.resize());
    },

    resize() {
      if (!this.canvas) return;
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    },

    burst(x = window.innerWidth / 2, y = window.innerHeight / 3, count = 65) {
      this.init();
      const colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 8 + 3;
        this.particles.push({
          x: x,
          y: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2,
          radius: Math.random() * 5 + 3,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 8,
          alpha: 1,
          decay: Math.random() * 0.015 + 0.01
        });
      }

      if (!this.animationId) {
        this.loop();
      }
    },

    loop() {
      if (!this.ctx || !this.canvas) return;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2; // gravity
        p.vx *= 0.98; // friction
        p.rotation += p.rotationSpeed;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          this.particles.splice(i, 1);
          continue;
        }

        this.ctx.save();
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate((p.rotation * Math.PI) / 180);
        this.ctx.globalAlpha = p.alpha;
        this.ctx.fillStyle = p.color;
        this.ctx.fillRect(-p.radius, -p.radius / 1.5, p.radius * 2, p.radius);
        this.ctx.restore();
      }

      if (this.particles.length > 0) {
        this.animationId = requestAnimationFrame(() => this.loop());
      } else {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.animationId = null;
      }
    }
  };

  // --- Local Storage & Persistence ---
  function saveState() {
    try {
      localStorage.setItem('taskflow_tasks', JSON.stringify(state.tasks));
      localStorage.setItem('taskflow_categories', JSON.stringify(state.categories));
      localStorage.setItem('taskflow_theme', state.theme);
      localStorage.setItem('taskflow_sound', JSON.stringify(state.soundEnabled));
      localStorage.setItem('taskflow_pomo_stats', JSON.stringify({
        completedCount: state.pomodoro.completedCount,
        totalFocusSeconds: state.pomodoro.totalFocusSeconds
      }));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }

  function loadState() {
    try {
      const savedTasks = localStorage.getItem('taskflow_tasks');
      state.tasks = savedTasks ? JSON.parse(savedTasks) : DEFAULT_TASKS;

      const savedCategories = localStorage.getItem('taskflow_categories');
      state.categories = savedCategories ? JSON.parse(savedCategories) : DEFAULT_CATEGORIES;

      const savedTheme = localStorage.getItem('taskflow_theme');
      state.theme = savedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

      const savedSound = localStorage.getItem('taskflow_sound');
      state.soundEnabled = savedSound !== null ? JSON.parse(savedSound) : true;

      const savedPomo = localStorage.getItem('taskflow_pomo_stats');
      if (savedPomo) {
        const stats = JSON.parse(savedPomo);
        state.pomodoro.completedCount = stats.completedCount || 0;
        state.pomodoro.totalFocusSeconds = stats.totalFocusSeconds || 0;
      }
    } catch (e) {
      console.warn('Error reading localStorage, reverting to defaults', e);
      state.tasks = DEFAULT_TASKS;
      state.categories = DEFAULT_CATEGORIES;
    }
  }

  // --- Theme Management ---
  function applyTheme(theme) {
    state.theme = theme;
    const htmlEl = document.documentElement;
    const themeIcon = document.getElementById('theme-icon');
    if (theme === 'dark') {
      htmlEl.classList.add('dark');
      if (themeIcon) themeIcon.setAttribute('data-lucide', 'sun');
    } else {
      htmlEl.classList.remove('dark');
      if (themeIcon) themeIcon.setAttribute('data-lucide', 'moon');
    }
    refreshLucideIcons();
    saveState();
  }

  function toggleTheme() {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  }

  function refreshLucideIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  // --- Formatting Helpers ---
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDueDate(dateStr) {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const parts = dateStr.split('-');
    const taskDate = new Date(parts[0], parts[1] - 1, parts[2]);
    taskDate.setHours(0, 0, 0, 0);

    const diffDays = Math.round((taskDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `${Math.abs(diffDays)}d overdue`, type: 'overdue' };
    } else if (diffDays === 0) {
      return { text: 'Today', type: 'today' };
    } else if (diffDays === 1) {
      return { text: 'Tomorrow', type: 'tomorrow' };
    } else if (diffDays < 7) {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return { text: days[taskDate.getDay()], type: 'upcoming' };
    } else {
      return {
        text: taskDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        type: 'upcoming'
      };
    }
  }

  // --- Navigation & View Filtering ---
  function getFilteredTasks() {
    let filtered = [...state.tasks];

    // Status filter: all, active, completed
    if (state.currentStatusFilter === 'active') {
      filtered = filtered.filter(t => !t.completed);
    } else if (state.currentStatusFilter === 'completed') {
      filtered = filtered.filter(t => t.completed);
    }

    // View filter
    const now = new Date().toISOString().split('T')[0];
    if (state.currentView === 'today') {
      filtered = filtered.filter(t => t.dueDate === now || (!t.completed && t.dueDate && t.dueDate < now));
    } else if (state.currentView === 'upcoming') {
      filtered = filtered.filter(t => t.dueDate && t.dueDate > now);
    } else if (state.currentView === 'starred') {
      filtered = filtered.filter(t => t.starred);
    } else if (state.currentView === 'completed') {
      filtered = filtered.filter(t => t.completed);
    } else if (state.currentView.startsWith('category:')) {
      const cat = state.currentView.replace('category:', '');
      filtered = filtered.filter(t => t.category === cat);
    } else if (state.currentView.startsWith('priority:')) {
      const prio = state.currentView.replace('priority:', '');
      filtered = filtered.filter(t => t.priority === prio);
    }

    // Search query filter
    if (state.searchQuery.trim()) {
      const q = state.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(t => {
        const inTitle = t.title.toLowerCase().includes(q);
        const inNotes = (t.notes || '').toLowerCase().includes(q);
        const inCat = (t.category || '').toLowerCase().includes(q);
        const inSubtasks = (t.subtasks || []).some(s => s.text.toLowerCase().includes(q));
        return inTitle || inNotes || inCat || inSubtasks;
      });
    }

    // Sorting
    filtered.sort((a, b) => {
      // Starred items can optionally be pinned to top unless sorting alphabetically
      if (a.starred !== b.starred && state.currentSort !== 'title-asc') {
        return a.starred ? -1 : 1;
      }

      if (state.currentSort === 'created-desc') {
        return new Date(b.createdAt) - new Date(a.createdAt);
      } else if (state.currentSort === 'title-asc') {
        return a.title.localeCompare(b.title);
      } else if (state.currentSort === 'due-asc') {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      } else if (state.currentSort === 'priority-desc') {
        const prioWeights = { high: 3, medium: 2, low: 1, none: 0 };
        const diff = (prioWeights[b.priority] || 0) - (prioWeights[a.priority] || 0);
        if (diff !== 0) return diff;
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
      return 0;
    });

    return filtered;
  }

  // --- Rendering UI ---
  function renderAll() {
    renderSidebarCounts();
    renderCategories();
    renderTasks();
    renderDailyProgress();
    renderPomodoroDisplay();
    refreshLucideIcons();
  }

  function renderSidebarCounts() {
    const today = new Date().toISOString().split('T')[0];
    const totalAll = state.tasks.filter(t => !t.completed).length;
    const totalToday = state.tasks.filter(t => !t.completed && (t.dueDate === today || (t.dueDate && t.dueDate < today))).length;
    const totalUpcoming = state.tasks.filter(t => !t.completed && t.dueDate && t.dueDate > today).length;
    const totalStarred = state.tasks.filter(t => !t.completed && t.starred).length;
    const totalCompleted = state.tasks.filter(t => t.completed).length;

    const countHigh = state.tasks.filter(t => !t.completed && t.priority === 'high').length;
    const countMed = state.tasks.filter(t => !t.completed && t.priority === 'medium').length;
    const countLow = state.tasks.filter(t => !t.completed && t.priority === 'low').length;

    const elBadgeAll = document.getElementById('badge-all');
    const elBadgeToday = document.getElementById('badge-today');
    const elBadgeUpcoming = document.getElementById('badge-upcoming');
    const elBadgeStarred = document.getElementById('badge-starred');
    const elBadgeCompleted = document.getElementById('badge-completed');

    if (elBadgeAll) elBadgeAll.textContent = totalAll;
    if (elBadgeToday) elBadgeToday.textContent = totalToday;
    if (elBadgeUpcoming) elBadgeUpcoming.textContent = totalUpcoming;
    if (elBadgeStarred) elBadgeStarred.textContent = totalStarred;
    if (elBadgeCompleted) elBadgeCompleted.textContent = totalCompleted;

    const elHigh = document.getElementById('badge-high');
    const elMed = document.getElementById('badge-medium');
    const elLow = document.getElementById('badge-low');
    if (elHigh) elHigh.textContent = countHigh;
    if (elMed) elMed.textContent = countMed;
    if (elLow) elLow.textContent = countLow;

    // Update active highlight on nav buttons
    document.querySelectorAll('.nav-item').forEach(btn => {
      const view = btn.getAttribute('data-view');
      const isSelected = state.currentView === view;
      if (isSelected) {
        btn.className = 'nav-item w-full flex items-center justify-between px-3 py-2 rounded-xl font-medium transition-colors bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300';
      } else {
        btn.className = 'nav-item w-full flex items-center justify-between px-3 py-2 rounded-xl font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors';
      }
    });

    document.querySelectorAll('.priority-nav-item').forEach(btn => {
      const prio = 'priority:' + btn.getAttribute('data-priority');
      const isSelected = state.currentView === prio;
      if (isSelected) {
        btn.classList.add('bg-slate-100', 'dark:bg-slate-800', 'font-semibold', 'text-slate-900', 'dark:text-white');
      } else {
        btn.classList.remove('bg-slate-100', 'dark:bg-slate-800', 'font-semibold', 'text-slate-900', 'dark:text-white');
      }
    });
  }

  function renderCategories() {
    const listEl = document.getElementById('category-list');
    const quickAddSelect = document.getElementById('new-task-category');
    const editSelect = document.getElementById('edit-task-category');

    if (listEl) {
      listEl.innerHTML = state.categories.map(cat => {
        const count = state.tasks.filter(t => !t.completed && t.category === cat).length;
        const isCurrent = state.currentView === 'category:' + cat;
        const activeClass = isCurrent
          ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 font-semibold'
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60';

        return `
          <div class="group flex items-center justify-between px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer ${activeClass}" data-category="${escapeHtml(cat)}">
            <div class="flex items-center space-x-2.5 truncate">
              <i data-lucide="folder" class="w-3.5 h-3.5 text-slate-400 group-hover:text-brand-500"></i>
              <span class="truncate">${escapeHtml(cat)}</span>
            </div>
            <div class="flex items-center space-x-1">
              <span class="text-[11px] text-slate-400 font-medium">${count}</span>
              ${cat !== 'Work' && cat !== 'Personal' ? `
                <button class="delete-cat-btn opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 p-0.5" data-del-cat="${escapeHtml(cat)}" title="Delete Category">
                  <i data-lucide="trash" class="w-3 h-3"></i>
                </button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');

      // Add click handlers for category items
      listEl.querySelectorAll('[data-category]').forEach(el => {
        el.addEventListener('click', (e) => {
          if (e.target.closest('.delete-cat-btn')) return;
          const cat = el.getAttribute('data-category');
          setView('category:' + cat);
        });
      });

      listEl.querySelectorAll('.delete-cat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const catToDel = btn.getAttribute('data-del-cat');
          deleteCategory(catToDel);
        });
      });
    }

    // Populate category dropdowns
    const optionsHtml = state.categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    if (quickAddSelect) quickAddSelect.innerHTML = optionsHtml;
    if (editSelect) editSelect.innerHTML = optionsHtml;
  }

  function renderDailyProgress() {
    const total = state.tasks.length;
    const completed = state.tasks.filter(t => t.completed).length;
    const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

    const progressBar = document.getElementById('daily-progress-bar');
    const pctLabel = document.getElementById('daily-percentage');
    const summaryLabel = document.getElementById('daily-task-summary');

    if (progressBar) progressBar.style.width = `${pct}%`;
    if (pctLabel) pctLabel.textContent = `${pct}%`;
    if (summaryLabel) summaryLabel.textContent = `${completed} of ${total} tasks completed`;
  }

  function renderTasks() {
    const container = document.getElementById('tasks-container');
    const emptyState = document.getElementById('empty-state');
    const viewTitleEl = document.getElementById('current-view-title');
    const viewDescEl = document.getElementById('current-view-desc');
    const counterEl = document.getElementById('active-task-counter');

    // Update View Title
    let titleText = 'All Tasks';
    let descText = 'Organize and conquer your day with clarity';
    if (state.currentView === 'today') {
      titleText = 'Today';
      descText = 'Focus on what matters most today';
    } else if (state.currentView === 'upcoming') {
      titleText = 'Upcoming';
      descText = 'Scheduled tasks on the horizon';
    } else if (state.currentView === 'starred') {
      titleText = 'Starred';
      descText = 'Your highest priority and favorite items';
    } else if (state.currentView === 'completed') {
      titleText = 'Completed';
      descText = 'Well done! Look back at what you accomplished';
    } else if (state.currentView.startsWith('category:')) {
      const cat = state.currentView.replace('category:', '');
      titleText = cat;
      descText = `Tasks in the "${cat}" category`;
    } else if (state.currentView.startsWith('priority:')) {
      const prio = state.currentView.replace('priority:', '');
      titleText = `${prio.charAt(0).toUpperCase() + prio.slice(1)} Priority`;
      descText = `Filtered by ${prio} priority tasks`;
    }

    if (viewTitleEl) viewTitleEl.textContent = titleText;
    if (viewDescEl) viewDescEl.textContent = descText;

    const tasks = getFilteredTasks();
    if (counterEl) {
      counterEl.textContent = `${tasks.length} task${tasks.length === 1 ? '' : 's'}`;
    }

    if (tasks.length === 0) {
      container.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    container.innerHTML = tasks.map(task => renderTaskCard(task)).join('');

    // Attach event listeners for each task card
    tasks.forEach(task => {
      const cardEl = document.getElementById(`task-card-${task.id}`);
      if (!cardEl) return;

      // Checkbox
      const checkBtn = cardEl.querySelector('.task-checkbox-btn');
      if (checkBtn) {
        checkBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleTaskCompleted(task.id);
        });
      }

      // Star
      const starBtn = cardEl.querySelector('.task-star-btn');
      if (starBtn) {
        starBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleTaskStar(task.id);
        });
      }

      // Edit
      const editBtn = cardEl.querySelector('.task-edit-btn');
      if (editBtn) {
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openEditModal(task.id);
        });
      }

      // Delete
      const deleteBtn = cardEl.querySelector('.task-delete-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteTask(task.id);
        });
      }

      // Focus in Pomodoro
      const focusBtn = cardEl.querySelector('.task-focus-btn');
      if (focusBtn) {
        focusBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          setPomodoroTask(task.id);
        });
      }

      // Expand / Toggle Details
      const toggleDetailsBtn = cardEl.querySelector('.task-expand-btn');
      if (toggleDetailsBtn) {
        toggleDetailsBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleTaskExpanded(task.id);
        });
      }

      // Subtask Checkboxes
      cardEl.querySelectorAll('.subtask-check-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const subId = btn.getAttribute('data-subtask-id');
          toggleSubtaskCompleted(task.id, subId);
        });
      });

      // Subtask Delete
      cardEl.querySelectorAll('.subtask-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const subId = btn.getAttribute('data-subtask-id');
          deleteSubtask(task.id, subId);
        });
      });

      // Subtask Add Form
      const subtaskForm = cardEl.querySelector('.add-subtask-form');
      if (subtaskForm) {
        subtaskForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const input = subtaskForm.querySelector('.add-subtask-input');
          if (input && input.value.trim()) {
            addSubtask(task.id, input.value.trim());
            input.value = '';
          }
        });
      }
    });
  }

  function renderTaskCard(task) {
    const isExpanded = state.expandedTaskId === task.id;
    const dueDateInfo = formatDueDate(task.dueDate);

    // Priority Styling
    let priorityBadge = '';
    let borderAccentClass = 'border-l-transparent';
    if (task.priority === 'high') {
      borderAccentClass = 'border-l-rose-500';
      priorityBadge = `<span class="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60">
        <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
        <span>High</span>
      </span>`;
    } else if (task.priority === 'medium') {
      borderAccentClass = 'border-l-amber-500';
      priorityBadge = `<span class="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60">
        <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
        <span>Medium</span>
      </span>`;
    } else if (task.priority === 'low') {
      borderAccentClass = 'border-l-emerald-500';
      priorityBadge = `<span class="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        <span>Low</span>
      </span>`;
    }

    // Due Date Badge Styling
    let dueDateBadge = '';
    if (dueDateInfo) {
      let dateClasses = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
      if (!task.completed) {
        if (dueDateInfo.type === 'overdue') {
          dateClasses = 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800';
        } else if (dueDateInfo.type === 'today') {
          dateClasses = 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800';
        } else if (dueDateInfo.type === 'tomorrow') {
          dateClasses = 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300';
        }
      }
      dueDateBadge = `
        <span class="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${dateClasses}">
          <i data-lucide="calendar" class="w-3 h-3"></i>
          <span>${dueDateInfo.text}</span>
        </span>
      `;
    }

    // Category Badge
    const categoryBadge = task.category ? `
      <span class="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
        <i data-lucide="tag" class="w-2.5 h-2.5 text-slate-400"></i>
        <span>${escapeHtml(task.category)}</span>
      </span>
    ` : '';

    // Subtasks summary
    const subtasks = task.subtasks || [];
    const totalSubs = subtasks.length;
    const completedSubs = subtasks.filter(s => s.completed).length;
    let subtasksBadge = '';
    if (totalSubs > 0) {
      subtasksBadge = `
        <span class="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
          <i data-lucide="check-square" class="w-3 h-3 text-brand-500"></i>
          <span>${completedSubs}/${totalSubs}</span>
        </span>
      `;
    }

    // Star state
    const starIconClass = task.starred ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600 hover:text-amber-400';

    return `
      <div id="task-card-${task.id}" class="group bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-sm hover:shadow-md transition-all border-l-4 ${borderAccentClass} ${task.completed ? 'opacity-60 bg-slate-50/70 dark:bg-slate-900/40' : ''}">
        <div class="flex items-start justify-between gap-3">
          <!-- Checkbox & Title -->
          <div class="flex items-start space-x-3 flex-1 min-w-0">
            <button class="task-checkbox-btn mt-0.5 w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${
              task.completed 
                ? 'bg-brand-600 border-brand-600 text-white' 
                : 'border-slate-300 dark:border-slate-600 hover:border-brand-500 text-transparent'
            }">
              <i data-lucide="check" class="w-3.5 h-3.5 stroke-[3]"></i>
            </button>

            <div class="flex-1 min-w-0 cursor-pointer task-expand-btn">
              <div class="flex items-center space-x-2">
                <span class="text-sm font-semibold text-slate-800 dark:text-slate-100 ${task.completed ? 'line-through text-slate-400 dark:text-slate-500' : ''} break-words">
                  ${escapeHtml(task.title)}
                </span>
              </div>

              <!-- Metadata Badges Row -->
              <div class="flex flex-wrap items-center gap-1.5 mt-1.5">
                ${priorityBadge}
                ${dueDateBadge}
                ${categoryBadge}
                ${subtasksBadge}
                ${task.notes ? `<i data-lucide="file-text" class="w-3.5 h-3.5 text-slate-400 ml-0.5" title="Has notes"></i>` : ''}
              </div>
            </div>
          </div>

          <!-- Quick Action Buttons -->
          <div class="flex items-center space-x-1 shrink-0">
            <!-- Focus Pomodoro -->
            ${!task.completed ? `
              <button class="task-focus-btn p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors" title="Focus on this task">
                <i data-lucide="timer" class="w-4 h-4"></i>
              </button>
            ` : ''}

            <!-- Star Toggle -->
            <button class="task-star-btn p-1.5 rounded-lg transition-colors" title="${task.starred ? 'Unstar' : 'Star'}">
              <i data-lucide="star" class="w-4 h-4 ${starIconClass}"></i>
            </button>

            <!-- Edit -->
            <button class="task-edit-btn p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Edit task">
              <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
            </button>

            <!-- Expand / Collapse -->
            <button class="task-expand-btn p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Toggle details">
              <i data-lucide="${isExpanded ? 'chevron-up' : 'chevron-down'}" class="w-4 h-4"></i>
            </button>

            <!-- Delete -->
            <button class="task-delete-btn p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors" title="Delete task">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>

        <!-- Expanded Detail Section -->
        ${isExpanded ? `
          <div class="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs space-y-3 animate-pop-in">
            ${task.notes ? `
              <div class="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl text-slate-700 dark:text-slate-300 whitespace-pre-line border border-slate-100 dark:border-slate-800">
                <p class="font-semibold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-wider mb-1">Notes</p>
                ${escapeHtml(task.notes)}
              </div>
            ` : ''}

            <!-- Subtasks Checklist -->
            <div>
              <p class="font-semibold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-wider mb-1.5">
                Checklist (${completedSubs}/${totalSubs})
              </p>
              
              <div class="space-y-1.5 mb-2">
                ${subtasks.map(sub => `
                  <div class="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 group/sub">
                    <div class="flex items-center space-x-2 flex-1">
                      <button data-subtask-id="${sub.id}" class="subtask-check-btn w-4 h-4 rounded border flex items-center justify-center ${
                        sub.completed ? 'bg-brand-600 border-brand-600 text-white' : 'border-slate-300 dark:border-slate-600'
                      }">
                        <i data-lucide="check" class="w-3 h-3 stroke-[3]"></i>
                      </button>
                      <span class="${sub.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-200'}">
                        ${escapeHtml(sub.text)}
                      </span>
                    </div>
                    <button data-subtask-id="${sub.id}" class="subtask-delete-btn text-slate-400 hover:text-rose-500 opacity-0 group-hover/sub:opacity-100 p-0.5">
                      <i data-lucide="x" class="w-3.5 h-3.5"></i>
                    </button>
                  </div>
                `).join('')}
              </div>

              <!-- Inline Add Subtask -->
              <form class="add-subtask-form flex items-center space-x-2">
                <input type="text" placeholder="Add checklist item..." class="add-subtask-input flex-1 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 text-slate-800 dark:text-slate-200">
                <button type="submit" class="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-medium">Add</button>
              </form>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  // --- Task Actions ---
  function addTask({ title, notes, dueDate, priority, category }) {
    if (!title || !title.trim()) return;

    const newTask = {
      id: 'task-' + Date.now(),
      title: title.trim(),
      notes: (notes || '').trim(),
      dueDate: dueDate || null,
      priority: priority || 'none',
      category: category || (state.categories[0] || 'General'),
      completed: false,
      completedAt: null,
      createdAt: new Date().toISOString(),
      starred: false,
      subtasks: []
    };

    state.tasks.unshift(newTask);
    saveState();
    renderAll();

    // Trigger subtle sound
    AudioEngine.playTone(480, 0.08, 'sine');
  }

  function toggleTaskCompleted(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date().toISOString() : null;

    if (task.completed) {
      AudioEngine.playComplete();
      // If task is completed and all active tasks in current view are completed, or priority was high, trigger confetti!
      const remainingActive = state.tasks.filter(t => !t.completed).length;
      if (remainingActive === 0 || task.priority === 'high') {
        Confetti.burst();
      }
    } else {
      AudioEngine.playUncheck();
    }

    saveState();
    renderAll();
  }

  function toggleTaskStar(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    task.starred = !task.starred;
    saveState();
    renderAll();
  }

  function deleteTask(taskId) {
    state.tasks = state.tasks.filter(t => t.id !== taskId);
    if (state.expandedTaskId === taskId) {
      state.expandedTaskId = null;
    }
    if (state.pomodoro.activeTaskId === taskId) {
      state.pomodoro.activeTaskId = null;
      updatePomodoroActiveTaskLabel();
    }
    saveState();
    renderAll();
  }

  function toggleTaskExpanded(taskId) {
    state.expandedTaskId = state.expandedTaskId === taskId ? null : taskId;
    renderTasks();
    refreshLucideIcons();
  }

  // Subtasks
  function addSubtask(taskId, text) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;
    if (!task.subtasks) task.subtasks = [];

    task.subtasks.push({
      id: 'sub-' + Date.now(),
      text: text.trim(),
      completed: false
    });

    saveState();
    renderAll();
  }

  function toggleSubtaskCompleted(taskId, subId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task || !task.subtasks) return;
    const sub = task.subtasks.find(s => s.id === subId);
    if (!sub) return;

    sub.completed = !sub.completed;
    if (sub.completed) {
      AudioEngine.playTone(600, 0.08, 'sine');
    }

    saveState();
    renderAll();
  }

  function deleteSubtask(taskId, subId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task || !task.subtasks) return;
    task.subtasks = task.subtasks.filter(s => s.id !== subId);

    saveState();
    renderAll();
  }

  // Categories
  function addCategory(name) {
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    if (state.categories.includes(trimmed)) return;

    state.categories.push(trimmed);
    saveState();
    renderAll();
  }

  function deleteCategory(name) {
    if (confirm(`Delete category "${name}"? Existing tasks will be moved to Personal.`)) {
      state.categories = state.categories.filter(c => c !== name);
      state.tasks.forEach(t => {
        if (t.category === name) {
          t.category = 'Personal';
        }
      });
      if (state.currentView === 'category:' + name) {
        state.currentView = 'inbox';
      }
      saveState();
      renderAll();
    }
  }

  function setView(view) {
    state.currentView = view;
    renderAll();
    // On mobile, close sidebar when clicking a view
    closeSidebar();
  }

  // --- Pomodoro Focus Timer ---
  function initPomodoro() {
    const modal = document.getElementById('pomodoro-modal');
    const toggleBtn = document.getElementById('pomodoro-toggle-btn');
    const closeBtn = document.getElementById('close-pomo-btn');

    const startBtn = document.getElementById('pomo-start-btn');
    const resetBtn = document.getElementById('pomo-reset-btn');

    const modeFocus = document.getElementById('pomo-mode-focus');
    const modeShort = document.getElementById('pomo-mode-short');
    const modeLong = document.getElementById('pomo-mode-long');

    toggleBtn.addEventListener('click', () => {
      modal.classList.remove('hidden');
      refreshPomodoroModal();
    });

    closeBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });

    modeFocus.addEventListener('click', () => switchPomodoroMode('focus', 1500));
    modeShort.addEventListener('click', () => switchPomodoroMode('short', 300));
    modeLong.addEventListener('click', () => switchPomodoroMode('long', 900));

    startBtn.addEventListener('click', () => togglePomodoroTimer());
    resetBtn.addEventListener('click', () => resetPomodoroTimer());
  }

  function switchPomodoroMode(mode, seconds) {
    if (state.pomodoro.isRunning) {
      clearInterval(state.pomodoro.timerId);
      state.pomodoro.isRunning = false;
    }
    state.pomodoro.mode = mode;
    state.pomodoro.duration = seconds;
    state.pomodoro.remaining = seconds;

    // Update active tab styles in modal
    const modes = {
      focus: document.getElementById('pomo-mode-focus'),
      short: document.getElementById('pomo-mode-short'),
      long: document.getElementById('pomo-mode-long')
    };

    Object.keys(modes).forEach(k => {
      if (k === mode) {
        modes[k].className = 'pomo-mode-btn flex-1 py-1.5 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-semibold';
      } else {
        modes[k].className = 'pomo-mode-btn flex-1 py-1.5 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white';
      }
    });

    updatePomodoroControlsUI();
    renderPomodoroDisplay();
  }

  function togglePomodoroTimer() {
    if (state.pomodoro.isRunning) {
      clearInterval(state.pomodoro.timerId);
      state.pomodoro.isRunning = false;
    } else {
      state.pomodoro.isRunning = true;
      state.pomodoro.timerId = setInterval(() => {
        if (state.pomodoro.remaining > 0) {
          state.pomodoro.remaining--;
          if (state.pomodoro.mode === 'focus') {
            state.pomodoro.totalFocusSeconds++;
          }
          renderPomodoroDisplay();
        } else {
          // Timer completed!
          clearInterval(state.pomodoro.timerId);
          state.pomodoro.isRunning = false;
          AudioEngine.playTimerChime();
          Confetti.burst();

          if (state.pomodoro.mode === 'focus') {
            state.pomodoro.completedCount++;
            saveState();
            // Prompt short break
            switchPomodoroMode('short', 300);
          } else {
            switchPomodoroMode('focus', 1500);
          }
        }
      }, 1000);
    }
    updatePomodoroControlsUI();
    renderPomodoroDisplay();
  }

  function resetPomodoroTimer() {
    if (state.pomodoro.isRunning) {
      clearInterval(state.pomodoro.timerId);
      state.pomodoro.isRunning = false;
    }
    state.pomodoro.remaining = state.pomodoro.duration;
    updatePomodoroControlsUI();
    renderPomodoroDisplay();
  }

  function setPomodoroTask(taskId) {
    state.pomodoro.activeTaskId = taskId;
    const modal = document.getElementById('pomodoro-modal');
    modal.classList.remove('hidden');
    refreshPomodoroModal();
    updatePomodoroActiveTaskLabel();
  }

  function updatePomodoroActiveTaskLabel() {
    const label = document.getElementById('pomo-active-task-label');
    if (!label) return;
    if (state.pomodoro.activeTaskId) {
      const task = state.tasks.find(t => t.id === state.pomodoro.activeTaskId);
      label.textContent = task ? `Focusing on: "${task.title}"` : 'No task selected for focus';
    } else {
      label.textContent = 'No task selected for focus';
    }
  }

  function updatePomodoroControlsUI() {
    const startText = document.getElementById('pomo-start-text');
    const startIcon = document.getElementById('pomo-start-icon');
    const badgeDot = document.getElementById('pomo-badge-dot');
    const pomoToggleBtn = document.getElementById('pomodoro-toggle-btn');

    if (startText) startText.textContent = state.pomodoro.isRunning ? 'Pause' : 'Start Focus';
    if (startIcon) {
      startIcon.setAttribute('data-lucide', state.pomodoro.isRunning ? 'pause' : 'play');
      refreshLucideIcons();
    }

    if (state.pomodoro.isRunning) {
      if (badgeDot) badgeDot.classList.remove('hidden');
      if (pomoToggleBtn) pomoToggleBtn.classList.add('pomodoro-active', 'border-rose-400', 'text-rose-600');
    } else {
      if (badgeDot) badgeDot.classList.add('hidden');
      if (pomoToggleBtn) pomoToggleBtn.classList.remove('pomodoro-active', 'border-rose-400', 'text-rose-600');
    }
  }

  function renderPomodoroDisplay() {
    const mins = Math.floor(state.pomodoro.remaining / 60);
    const secs = state.pomodoro.remaining % 60;
    const timeFormatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    const largeDisplay = document.getElementById('pomo-timer-large');
    const smallDisplay = document.getElementById('pomo-timer-display');

    if (largeDisplay) largeDisplay.textContent = timeFormatted;
    if (smallDisplay) smallDisplay.textContent = timeFormatted;

    const countEl = document.getElementById('pomo-completed-count');
    const timeFocusedEl = document.getElementById('pomo-time-focused');
    if (countEl) countEl.textContent = state.pomodoro.completedCount;
    if (timeFocusedEl) {
      const focusMins = Math.floor(state.pomodoro.totalFocusSeconds / 60);
      timeFocusedEl.textContent = `${focusMins}m`;
    }
  }

  function refreshPomodoroModal() {
    updatePomodoroControlsUI();
    updatePomodoroActiveTaskLabel();
    renderPomodoroDisplay();
  }

  // --- Statistics Modal ---
  function openStatsModal() {
    const modal = document.getElementById('stats-modal');
    const total = state.tasks.length;
    const completed = state.tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const rate = total === 0 ? 0 : Math.round((completed / total) * 100);

    document.getElementById('stat-total-tasks').textContent = total;
    document.getElementById('stat-completed-tasks').textContent = completed;
    document.getElementById('stat-pending-tasks').textContent = pending;
    document.getElementById('stat-rate-tasks').textContent = `${rate}%`;

    // Category breakdown
    const catContainer = document.getElementById('stats-category-breakdown');
    catContainer.innerHTML = state.categories.map(cat => {
      const catTasks = state.tasks.filter(t => t.category === cat);
      const catCompleted = catTasks.filter(t => t.completed).length;
      const catTotal = catTasks.length;
      const catPct = catTotal === 0 ? 0 : Math.round((catCompleted / catTotal) * 100);

      return `
        <div class="space-y-1">
          <div class="flex justify-between text-xs">
            <span class="font-medium text-slate-700 dark:text-slate-300">${escapeHtml(cat)}</span>
            <span class="text-slate-400">${catCompleted}/${catTotal} (${catPct}%)</span>
          </div>
          <div class="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
            <div class="bg-brand-500 h-full rounded-full transition-all" style="width: ${catPct}%"></div>
          </div>
        </div>
      `;
    }).join('');

    // Priority breakdown
    const prioContainer = document.getElementById('stats-priority-breakdown');
    const high = state.tasks.filter(t => t.priority === 'high');
    const med = state.tasks.filter(t => t.priority === 'medium');
    const low = state.tasks.filter(t => t.priority === 'low');

    prioContainer.innerHTML = `
      <div class="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60">
        <span class="font-bold text-rose-600 block text-base">${high.filter(t => t.completed).length}/${high.length}</span>
        <span class="text-rose-700 dark:text-rose-300 font-semibold text-[11px]">High</span>
      </div>
      <div class="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60">
        <span class="font-bold text-amber-600 block text-base">${med.filter(t => t.completed).length}/${med.length}</span>
        <span class="text-amber-700 dark:text-amber-300 font-semibold text-[11px]">Medium</span>
      </div>
      <div class="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60">
        <span class="font-bold text-emerald-600 block text-base">${low.filter(t => t.completed).length}/${low.length}</span>
        <span class="text-emerald-700 dark:text-emerald-300 font-semibold text-[11px]">Low</span>
      </div>
    `;

    modal.classList.remove('hidden');
    refreshLucideIcons();
  }

  // --- Task Edit Modal ---
  function openEditModal(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    document.getElementById('edit-task-id').value = task.id;
    document.getElementById('edit-task-title').value = task.title;
    document.getElementById('edit-task-notes').value = task.notes || '';
    document.getElementById('edit-task-date').value = task.dueDate || '';
    document.getElementById('edit-task-priority').value = task.priority || 'none';
    document.getElementById('edit-task-category').value = task.category || state.categories[0];

    document.getElementById('task-edit-modal').classList.remove('hidden');
    refreshLucideIcons();
  }

  function handleEditTaskSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('edit-task-id').value;
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;

    task.title = document.getElementById('edit-task-title').value.trim();
    task.notes = document.getElementById('edit-task-notes').value.trim();
    task.dueDate = document.getElementById('edit-task-date').value || null;
    task.priority = document.getElementById('edit-task-priority').value;
    task.category = document.getElementById('edit-task-category').value;

    document.getElementById('task-edit-modal').classList.add('hidden');
    saveState();
    renderAll();
  }

  // --- Export & Import Data ---
  function exportData() {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      tasks: state.tasks,
      categories: state.categories
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `taskflow-backup-${todayStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (Array.isArray(data.tasks)) {
          state.tasks = data.tasks;
          if (Array.isArray(data.categories)) {
            state.categories = data.categories;
          }
          saveState();
          renderAll();
          alert('Tasks successfully imported!');
          document.getElementById('settings-modal').classList.add('hidden');
        } else {
          alert('Invalid file format. Expected a TaskFlow JSON export.');
        }
      } catch (err) {
        alert('Could not parse JSON file.');
      }
    };
    reader.readAsText(file);
  }

  function resetSampleTasks() {
    if (confirm('Reset your tasks to default sample tasks? This will overwrite existing tasks.')) {
      state.tasks = JSON.parse(JSON.stringify(DEFAULT_TASKS));
      state.categories = [...DEFAULT_CATEGORIES];
      saveState();
      renderAll();
      document.getElementById('settings-modal').classList.add('hidden');
    }
  }

  function clearCompletedTasks() {
    const completedCount = state.tasks.filter(t => t.completed).length;
    if (completedCount === 0) {
      alert('No completed tasks to clear.');
      return;
    }
    if (confirm(`Remove all ${completedCount} completed tasks?`)) {
      state.tasks = state.tasks.filter(t => !t.completed);
      saveState();
      renderAll();
      document.getElementById('settings-modal').classList.add('hidden');
    }
  }

  // --- Mobile Sidebar Controls ---
  function openSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('mobile-sidebar-backdrop');
    sidebar.classList.remove('-translate-x-full');
    backdrop.classList.remove('hidden');
  }

  function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('mobile-sidebar-backdrop');
    sidebar.classList.add('-translate-x-full');
    backdrop.classList.add('hidden');
  }

  // --- Setup Event Listeners ---
  function setupEventListeners() {
    // Mobile Drawer
    document.getElementById('open-sidebar-btn').addEventListener('click', openSidebar);
    document.getElementById('close-sidebar-btn').addEventListener('click', closeSidebar);
    document.getElementById('mobile-sidebar-backdrop').addEventListener('click', closeSidebar);

    // Sidebar navigation views
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        setView(view);
      });
    });

    // Priority nav items
    document.querySelectorAll('.priority-nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const prio = btn.getAttribute('data-priority');
        setView('priority:' + prio);
      });
    });

    // Add category button
    document.getElementById('add-category-btn').addEventListener('click', () => {
      const name = prompt('Enter new category name:');
      if (name) addCategory(name);
    });

    // Quick Add Form
    const quickAddForm = document.getElementById('quick-add-form');
    quickAddForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const titleInput = document.getElementById('new-task-title');
      const dateInput = document.getElementById('new-task-date');
      const priorityInput = document.getElementById('new-task-priority');
      const categoryInput = document.getElementById('new-task-category');
      const notesInput = document.getElementById('new-task-notes');

      addTask({
        title: titleInput.value,
        dueDate: dateInput.value || null,
        priority: priorityInput.value,
        category: categoryInput.value,
        notes: notesInput.value
      });

      titleInput.value = '';
      notesInput.value = '';
      dateInput.value = '';
      priorityInput.value = 'none';
      document.getElementById('quick-add-notes-container').classList.add('hidden');
      titleInput.focus();
    });

    // Toggle Notes Button in Quick Add
    document.getElementById('toggle-notes-btn').addEventListener('click', () => {
      const container = document.getElementById('quick-add-notes-container');
      container.classList.toggle('hidden');
      if (!container.classList.contains('hidden')) {
        document.getElementById('new-task-notes').focus();
      }
    });

    // Sidebar Quick Add button
    document.getElementById('sidebar-new-task-btn').addEventListener('click', () => {
      closeSidebar();
      const input = document.getElementById('new-task-title');
      input.scrollIntoView({ behavior: 'smooth' });
      input.focus();
    });

    // Status Filter Tabs (All / Active / Completed)
    document.querySelectorAll('.status-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        state.currentStatusFilter = tab.getAttribute('data-status');
        document.querySelectorAll('.status-tab').forEach(t => {
          t.className = 'status-tab px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all';
        });
        tab.className = 'status-tab px-3 py-1.5 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm transition-all font-semibold';
        renderTasks();
        refreshLucideIcons();
      });
    });

    // Sort Dropdown
    document.getElementById('sort-select').addEventListener('change', (e) => {
      state.currentSort = e.target.value;
      renderTasks();
      refreshLucideIcons();
    });

    // Search Input
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');

    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      if (state.searchQuery) {
        clearSearchBtn.classList.remove('hidden');
      } else {
        clearSearchBtn.classList.add('hidden');
      }
      renderTasks();
      refreshLucideIcons();
    });

    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      state.searchQuery = '';
      clearSearchBtn.classList.add('hidden');
      renderTasks();
      refreshLucideIcons();
      searchInput.focus();
    });

    // Sound Toggle
    const soundBtn = document.getElementById('sound-toggle-btn');
    soundBtn.addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      const soundIcon = document.getElementById('sound-icon');
      soundIcon.setAttribute('data-lucide', state.soundEnabled ? 'volume-2' : 'volume-x');
      refreshLucideIcons();
      saveState();
      if (state.soundEnabled) {
        AudioEngine.playTone(520, 0.1);
      }
    });

    // Theme Toggle
    document.getElementById('theme-toggle-btn').addEventListener('click', toggleTheme);

    // Stats Modal
    document.getElementById('stats-modal-btn').addEventListener('click', openStatsModal);
    document.getElementById('close-stats-btn').addEventListener('click', () => {
      document.getElementById('stats-modal').classList.add('hidden');
    });

    // Settings Modal
    const settingsModal = document.getElementById('settings-modal');
    document.getElementById('settings-menu-btn').addEventListener('click', () => {
      settingsModal.classList.remove('hidden');
      refreshLucideIcons();
    });
    document.getElementById('close-settings-btn').addEventListener('click', () => {
      settingsModal.classList.add('hidden');
    });

    // Modal Background Clicks
    [settingsModal, document.getElementById('stats-modal'), document.getElementById('task-edit-modal')].forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
      });
    });

    // Edit Modal Form & Controls
    document.getElementById('edit-task-form').addEventListener('submit', handleEditTaskSubmit);
    document.getElementById('close-edit-modal-btn').addEventListener('click', () => {
      document.getElementById('task-edit-modal').classList.add('hidden');
    });
    document.getElementById('cancel-edit-btn').addEventListener('click', () => {
      document.getElementById('task-edit-modal').classList.add('hidden');
    });

    // Export / Import / Reset / Clear
    document.getElementById('export-json-btn').addEventListener('click', exportData);
    document.getElementById('import-json-file').addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        importData(e.target.files[0]);
      }
    });
    document.getElementById('clear-completed-btn').addEventListener('click', clearCompletedTasks);
    document.getElementById('reset-sample-btn').addEventListener('click', resetSampleTasks);

    // Empty state Add button
    document.getElementById('empty-add-btn').addEventListener('click', () => {
      state.currentStatusFilter = 'all';
      document.querySelectorAll('.status-tab').forEach((t, i) => {
        if (i === 0) {
          t.className = 'status-tab px-3 py-1.5 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm transition-all font-semibold';
        } else {
          t.className = 'status-tab px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all';
        }
      });
      renderTasks();
      const input = document.getElementById('new-task-title');
      input.focus();
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      // Avoid hotkeys when typing in form inputs
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      const isInput = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';

      if (e.key === 'Escape') {
        document.getElementById('pomodoro-modal').classList.add('hidden');
        document.getElementById('stats-modal').classList.add('hidden');
        document.getElementById('settings-modal').classList.add('hidden');
        document.getElementById('task-edit-modal').classList.add('hidden');
        closeSidebar();
        if (document.activeElement) document.activeElement.blur();
        return;
      }

      if (isInput) return;

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        const input = document.getElementById('new-task-title');
        input.focus();
      } else if (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        const search = document.getElementById('search-input');
        search.focus();
        search.select();
      } else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        toggleTheme();
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        const pomoModal = document.getElementById('pomodoro-modal');
        pomoModal.classList.toggle('hidden');
        if (!pomoModal.classList.contains('hidden')) {
          refreshPomodoroModal();
        }
      }
    });
  }

  // --- Bootstrap App ---
  function init() {
    loadState();
    applyTheme(state.theme);
    setupEventListeners();
    initPomodoro();
    Confetti.init();
    renderAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
