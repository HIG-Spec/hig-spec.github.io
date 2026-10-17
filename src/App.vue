<script setup lang="ts">
import {
  computed,
  ref,
  onMounted,
  onBeforeUnmount,
  defineAsyncComponent,
  watch,
  nextTick,
} from 'vue';
import {
  loadData,
  ready,
  loadError,
  database,
  categories,
  clean,
  platformName,
} from './data/store';
import { route, go } from './data/router';
import CatalogPage from './pages/CatalogPage.vue';
const ComponentPage = defineAsyncComponent(() => import('./pages/ComponentPage.vue'));
const MaterialsPage = defineAsyncComponent(() => import('./pages/MaterialsPage.vue'));
const TypographyPage = defineAsyncComponent(() => import('./pages/TypographyPage.vue'));
const SourcesPage = defineAsyncComponent(() => import('./pages/SourcesPage.vue'));
const search = ref<HTMLDialogElement>(),
  searchInput = ref<HTMLInputElement>(),
  q = ref(''),
  mobile = ref(false),
  theme = ref('light'),
  focusIndex = ref(0);
const groups = computed(() =>
  categories.map(([id, label]) => ({
    id,
    label,
    items: database.value?.families.filter((f) => f.category === id) ?? [],
  })),
);
const results = computed(() => {
  const text = q.value.trim().toLowerCase();
  if (!text) return [];
  const families = (database.value?.families ?? [])
    .filter((f) => (f.zh + f.name).toLowerCase().includes(text))
    .map((f) => ({
      key: f.id,
      title: f.zh,
      subtitle: f.name,
      url: '/components/' + f.id,
      query: {},
    }));
  const components = (database.value?.components ?? [])
    .filter((c) => clean(c.name).toLowerCase().includes(text))
    .slice(0, 24)
    .map((c) => ({
      key: c.id,
      title: clean(c.name),
      subtitle: platformName(c.platform),
      url: '/components/' + c.family,
      query: { v: c.id },
    }));
  return [...families, ...components].slice(0, 30);
});
watch(q, () => (focusIndex.value = 0));
watch(route, () => {
  mobile.value = false;
  document.title = 'HIG Spec';
});
async function openSearch() {
  search.value?.showModal();
  await nextTick();
  searchInput.value?.focus();
}
function jump(r: any) {
  search.value?.close();
  go(r.url, r.query);
}
function keys(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openSearch();
  }
}
function resultKeys(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    focusIndex.value = Math.min(results.value.length - 1, focusIndex.value + 1);
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    focusIndex.value = Math.max(0, focusIndex.value - 1);
  }
  if (e.key === 'Enter' && results.value[focusIndex.value]) {
    e.preventDefault();
    jump(results.value[focusIndex.value]);
  }
}
function setTheme(t: string) {
  theme.value = t;
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem('hig-theme', t);
  } catch {}
}
onMounted(() => {
  let t = matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
  try {
    t = localStorage.getItem('hig-theme') ?? t;
  } catch {}
  setTheme(t);
  loadData();
  window.addEventListener('keydown', keys);
});
onBeforeUnmount(() => window.removeEventListener('keydown', keys));
</script>
<template>
  <header class="topbar">
    <a class="brand" href="#/components"><span class="brand-mark">H</span>HIG Spec</a>
    <nav class="topnav">
      <a href="#/components" :class="{ active: route.path.startsWith('/components') }">组件</a
      ><a href="#/materials/liquid-glass" :class="{ active: route.path.startsWith('/materials') }"
        >材质</a
      ><a href="#/typography" :class="{ active: route.path === '/typography' }">排版</a>
    </nav>
    <div class="top-actions">
      <button class="search-trigger" @click="openSearch" aria-label="搜索规格">
        搜索 <kbd>⌘ K</kbd></button
      ><button
        class="icon-button theme-button"
        @click="setTheme(theme === 'light' ? 'dark' : 'light')"
        aria-label="切换深浅色"
      >
        {{ theme === 'light' ? '◐' : '◑' }}</button
      ><button
        class="icon-button mobile-toggle"
        @click="mobile = !mobile"
        :aria-expanded="mobile"
        aria-label="组件导航"
      >
        ☰
      </button>
    </div>
  </header>
  <div class="app-body">
    <button v-if="mobile" class="nav-scrim" aria-label="关闭导航" @click="mobile = false"></button>
    <aside class="sidebar" :class="{ open: mobile }">
      <a href="#/components" class="side-home">组件目录</a>
      <div v-for="g in groups" :key="g.id" class="side-group">
        <h2>{{ g.label }}</h2>
        <a
          v-for="f in g.items"
          :key="f.id"
          :href="'#/components/' + f.id"
          :class="{ active: route.path === '/components/' + f.id }"
          >{{ f.zh }}<span>{{ f.name }}</span></a
        >
      </div>
      <div class="side-group foundations">
        <h2>基础</h2>
        <a href="#/materials/liquid-glass" :class="{ active: route.path.startsWith('/materials') }"
          >Liquid Glass</a
        ><a href="#/typography">字体与排版</a><a href="#/sources">来源与单位</a>
      </div>
    </aside>
    <main id="main">
      <template v-if="ready"
        ><CatalogPage v-if="route.path === '/components' || route.path === '/'" /><ComponentPage
          v-else-if="route.path.startsWith('/components/') || route.path === '/definition'"
          :key="route.path"
        /><MaterialsPage v-else-if="route.path.startsWith('/materials')" /><TypographyPage
          v-else-if="route.path === '/typography'"
        /><SourcesPage v-else-if="route.path === '/sources'" />
        <div v-else class="empty">
          <h1>页面未找到</h1>
          <a href="#/components">返回目录</a>
        </div></template
      >
      <div v-else-if="loadError" class="empty" role="alert">
        <h1>规格暂时无法载入</h1>
        <p>{{ loadError }}</p>
        <button
          class="button primary"
          @click="
            loadError = '';
            loadData();
          "
        >
          重试
        </button>
      </div>
      <div v-else class="loading" role="status">
        <div class="loading-line"></div>
        <h1>HIG Spec</h1>
        <p>正在载入组件规格…</p>
      </div>
      <footer class="footer">
        <span>HIG Spec · 独立设计参考</span><a href="#/sources">来源与单位</a
        ><a href="https://github.com/HIG-Spec/hig-spec.github.io" target="_blank" rel="noopener"
          >GitHub ↗</a
        >
      </footer>
    </main>
  </div>
  <dialog ref="search" class="search-dialog" @click="$event.target === search && search?.close()">
    <div class="search-dialog-inner">
      <div class="search-box">
        <input
          ref="searchInput"
          v-model="q"
          placeholder="搜索组件、状态或尺寸…"
          aria-label="搜索全部规格"
          @keydown="resultKeys"
        /><button class="button quiet" @click="search?.close()">Esc</button>
      </div>
      <div class="search-results">
        <p v-if="!q" class="search-hint">例如 Switch、Pressed、Slider 或按钮</p>
        <p v-else-if="!results.length" class="search-hint">没有找到匹配的规格</p>
        <button
          v-for="(r, i) in results"
          :key="r.key"
          :class="{ selected: i === focusIndex }"
          @click="jump(r)"
        >
          <strong>{{ r.title }}</strong
          ><span>{{ r.subtitle }}</span>
        </button>
      </div>
    </div>
  </dialog>
</template>
