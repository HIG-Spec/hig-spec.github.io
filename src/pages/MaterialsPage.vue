<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { database, materials, clean, platformName } from '../data/store';
import { route, updateQuery, go } from '../data/router';
import type { Definition, Platform } from '../data/types';
import { resolve, flatten, enabled } from '../specs/materials.js';
import { download } from '../specs/exports';
import RecipePanel from '../components/RecipePanel.vue';
import LivePreview from '../components/LivePreview.vue';
const platform = computed(() => (route.value.query.get('platform') ?? 'ios') as Platform);
const localID = computed(() => route.value.query.get('local'));
const presets = computed(() =>
  materials.value!.styles.filter((s) => s.catalog && s.platform === platform.value),
);
const shared = computed(
  () => presets.value.find((s) => s.id === route.value.query.get('style')) ?? presets.value[0],
);
const localRecords = computed(() =>
  Object.entries(materials.value!.bindings).flatMap(([ci, rows]) => {
    const c = database.value!.components[Number(ci)];
    if (c.platform !== platform.value) return [];
    const ns = flatten(c.root);
    return rows
      .filter(([, ri, si]) => si === null && enabled(materials.value!.recipes[ri]))
      .map(([ni, ri]) => ({
        key: c.id + '~' + ni,
        c,
        node: ns[ni],
        recipe: materials.value!.recipes[ri],
      }));
  }),
);
const locals = computed(() => {
  const seen = new Set<string>();
  return localRecords.value.filter((r) => {
    const key = r.c.family + ':' + JSON.stringify(r.recipe.blurs);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
});
const local = computed(() => localRecords.value.find((r) => r.key === localID.value));
const recipe = computed(() => local.value?.recipe ?? materials.value!.recipes[shared.value.recipe]);
const dark = computed(
  () =>
    local.value?.c.facets.appearance === 'dark' ||
    (!local.value && shared.value.name.includes('/Dark/')),
);
const preview = computed<Definition>(
  () =>
    local.value?.c ?? {
      id: 'material-sample',
      name: shared.value.name,
      platform: platform.value,
      internal: true,
      family: 'materials',
      symbolID: '',
      facets: { appearance: dark.value ? 'dark' : 'light', size: '', state: '' },
      source: { member: '', pointer: '', nodeID: '', page: '' },
      root: {
        id: 'material-sample-root',
        name: 'Material sample',
        type: 'rectangle',
        f: [0, 0, 260, 148],
        path: '',
        style: { corners: { radii: [32] } },
      },
    },
);
const uses = computed(() =>
  local.value
    ? [local.value.c]
    : database.value!.components.filter(
        (c) =>
          !c.internal &&
          c.platform === platform.value &&
          resolve(c).records.some((r: any) => !r.hidden && r.shared?.id === shared.value.id),
      ),
);
const query = ref(''),
  list = computed(() =>
    locals.value.filter((r) => clean(r.c.name).toLowerCase().includes(query.value.toLowerCase())),
  );
function selectStyle(id: string) {
  updateQuery({ style: id, local: '' });
}
watch(
  [platform, shared, local],
  () => {
    document.title = 'Liquid Glass · HIG Spec';
  },
  { immediate: true },
);
</script>
<template>
  <article class="material-page">
    <header class="page-heading">
      <div class="eyebrow">MATERIALS</div>
      <h1>Liquid Glass</h1>
      <p>光学参数、填充与阴影。共享预设与组件局部材质。</p>
    </header>
    <div class="variant-bar">
      <div class="pills">
        <button
          v-for="p in ['ios', 'macos']"
          :key="p"
          :class="{ active: platform === p }"
          @click="updateQuery({ platform: p, style: '', local: '' })"
        >
          {{ platformName(p) }}
        </button>
      </div>
      <label class="grow"
        >共享预设<select
          :value="local ? '' : shared.id"
          @change="selectStyle(($event.target as HTMLSelectElement).value)"
          aria-label="共享材质预设"
        >
          <option v-if="local" value="" disabled>已选择组件局部材质</option>
          <option v-for="s in presets" :key="s.id" :value="s.id">
            {{ s.name.replace('Liquid Glass/', '').replaceAll('/', ' / ')
            }}{{
              presets.filter((x) => x.name === s.name).length > 1 ? ' · ' + s.id.slice(0, 6) : ''
            }}
          </option>
        </select></label
      ><button
        class="button quiet"
        @click="
          download(
            { style: local ? { component: local.c.id, node: local.node.id } : shared, recipe },
            'liquid-glass.json',
          )
        "
      >
        导出 JSON
      </button>
    </div>
    <div class="material-preview-heading">
      <span class="tag">{{ local ? '组件局部材质' : '共享材质' }}</span
      ><strong>{{
        local
          ? clean(local.c.name)
          : shared.name.replace('Liquid Glass/', '').replaceAll('/', ' / ')
      }}</strong>
    </div>
    <LivePreview :key="preview.id" :component="preview" :recipe="local ? undefined : recipe" />
    <div class="spec-columns">
      <div class="spec-main">
        <section class="spec-section">
          <h2>材质规格</h2>
          <RecipePanel :recipe="recipe" />
          <details class="disclosure">
            <summary>设计来源</summary>
            <pre>{{
              JSON.stringify(
                local
                  ? { component: local.c.source, node: local.node.id, path: local.node.path }
                  : shared,
                null,
                2,
              )
            }}</pre>
          </details>
        </section>
        <section class="spec-section">
          <div class="section-heading">
            <h2>组件局部材质</h2>
            <input
              type="search"
              v-model="query"
              placeholder="Switch、Slider…"
              aria-label="搜索局部材质"
            />
          </div>
          <p class="small muted">按压态和子部件的材质，独立于共享预设。</p>
          <div class="local-material-grid">
            <button
              v-for="r in list"
              :key="r.key"
              class="local-material"
              :class="{ selected: local?.key === r.key }"
              @click="updateQuery({ local: r.key })"
            >
              <strong>{{
                database!.families.find((f) => f.id === r.c.family)?.zh ?? r.c.family
              }}</strong
              ><span>{{ clean(r.c.name).split('/').slice(-3).join(' / ') }}</span
              ><small
                >Blur {{ r.recipe.blurs?.find((b: any) => b.type === 4)?.radius ?? '—' }} ·
                Distortion
                {{ r.recipe.blurs?.find((b: any) => b.type === 4)?.distortion ?? '—' }}</small
              >
            </button>
          </div>
        </section>
        <section class="spec-section">
          <h2>使用此材质的组件</h2>
          <div class="usage-list">
            <a
              v-for="c in uses.slice(0, 24)"
              :key="c.id"
              :href="'#/components/' + c.family + '?v=' + encodeURIComponent(c.id)"
              >{{ clean(c.name) }} ↗</a
            >
            <p v-if="!uses.length" class="muted">当前文件中未发现组件引用。</p>
          </div>
          <p v-if="uses.length > 24" class="small muted">
            显示前 24 项，共 {{ uses.length }} 个变体。
          </p>
        </section>
      </div>
      <aside class="toc">
        <span>字段说明</span>
        <p>Radius 是模糊参数，不是圆角。</p>
        <p>Distortion、Depth 与色差保留设计工具原值。</p>
        <a href="#/sources">来源与单位 ↗</a>
      </aside>
    </div>
  </article>
</template>
