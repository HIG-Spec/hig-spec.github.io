<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  database,
  defaultDefinition,
  familyDefinitions,
  glassRecords,
  categories,
} from '../data/store';
import type { Platform } from '../data/types';
import LivePreview from '../components/LivePreview.vue';
const category = ref('all'),
  platform = ref<Platform | 'all'>('all'),
  query = ref('');
const families = computed(
  () =>
    database.value?.families.filter(
      (f) =>
        (category.value === 'all' || f.category === category.value) &&
        (platform.value === 'all' || f.platforms.includes(platform.value)) &&
        (f.zh + f.name).toLowerCase().includes(query.value.toLowerCase()),
    ) ?? [],
);
const preview = (family: string) => {
  const c = defaultDefinition(family, platform.value === 'all' ? 'ios' : platform.value);
  if (!c) return;
  if (family === 'switches')
    return (
      familyDefinitions(family, c.platform).find(
        (d) => d.name === 'Toggles/Light/On/3 - Pressed',
      ) ?? c
    );
  return c;
};
const descriptions: Record<string, string> = {
  buttons: '文字、图标与容器',
  switches: '开启、关闭与按压状态',
  'segmented-controls': '分段布局与选中指示',
  'date-time-pickers': '日期、时间与滚轮',
  sliders: '轨道、刻度与旋钮',
  'text-fields': '输入区域与排版',
  'tab-bars': '条目与导航容器',
  toolbars: '操作组合与玻璃底板',
  menus: '菜单行与项目间距',
};
</script>
<template>
  <div class="catalog">
    <header class="catalog-hero">
      <div>
        <div class="eyebrow">APPLE INTERFACE REFERENCE</div>
        <h1>组件。</h1>
        <p>从尺寸、间距到材质。<br />为每一处界面细节提供参考。</p>
        <div class="hero-links"><span>iOS / iPadOS 27</span><span>macOS 27</span></div>
      </div>
      <a class="material-promo" href="#/materials/liquid-glass"
        ><div class="promo-orb"></div>
        <div class="promo-glass">
          <span>Materials</span><strong>Liquid<br />Glass</strong><span>材质参数与交互预览 ↗</span>
        </div></a
      >
    </header>
    <div class="catalog-filter">
      <div class="pills">
        <button :class="{ active: category === 'all' }" @click="category = 'all'">全部</button
        ><button
          v-for="[k, l] in categories"
          :key="k"
          @click="category = k"
          :class="{ active: category === k }"
        >
          {{ l }}
        </button>
      </div>
      <label class="sr-only" for="catalogPlatform">平台</label
      ><select id="catalogPlatform" v-model="platform">
        <option value="all">所有平台</option>
        <option value="ios">iOS / iPadOS</option>
        <option value="macos">macOS</option></select
      ><input
        class="filter-search"
        type="search"
        v-model="query"
        placeholder="筛选组件"
        aria-label="筛选组件"
      />
    </div>
    <div class="catalog-grid">
      <a
        v-for="f in families"
        :key="f.id"
        class="catalog-card"
        :href="`#/components/${f.id}${platform !== 'all' ? '?platform=' + platform : ''}`"
        ><div class="card-visual">
          <LivePreview v-if="preview(f.id)" :component="preview(f.id)!" compact />
        </div>
        <div class="card-copy">
          <h2>{{ f.zh }} <span>↗</span></h2>
          <p>{{ f.name }}</p>
          <small>{{ descriptions[f.id] ?? '尺寸、布局与状态规格' }}</small>
        </div></a
      >
    </div>
    <div v-if="!families.length" class="empty">
      <h2>没有匹配的组件</h2>
      <button
        class="button"
        @click="
          query = '';
          category = 'all';
          platform = 'all';
        "
      >
        清除筛选
      </button>
    </div>
  </div>
</template>
