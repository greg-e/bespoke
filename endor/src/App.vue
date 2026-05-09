<script setup>
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div>
        <p class="brand-kicker">Private productivity starter</p>
        <h1>endor</h1>
      </div>

      <nav class="nav">
        <RouterLink to="/today">Today</RouterLink>
        <RouterLink to="/tasks">Tasks</RouterLink>
        <RouterLink to="/calendar">Calendar</RouterLink>
      </nav>
    </header>

    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100svh;
  display: flex;
  flex-direction: column;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 20px 28px;
  border-bottom: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(18px);
}

.brand-kicker {
  margin: 0 0 4px;
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
}

h1 {
  margin: 0;
  font-size: 24px;
  letter-spacing: -0.04em;
}

.nav {
  display: flex;
  gap: 20px;
}

.nav a {
  color: var(--muted);
  text-decoration: none;
  font-weight: 600;
  padding: 8px 0;
  border-bottom: 2px solid transparent;
}

.nav a.router-link-active {
  color: var(--text-strong);
  border-bottom-color: var(--accent);
}

.app-main {
  flex: 1;
  padding: 28px;
  width: min(1200px, calc(100% - 56px));
  margin: 0 auto;
  box-sizing: border-box;
}

@media (max-width: 720px) {
  .app-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .app-main {
    width: min(100%, calc(100% - 32px));
    padding: 16px;
  }

  .nav {
    gap: 14px;
    flex-wrap: wrap;
  }
}
</style>
