<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  database,
  byID,
  defaultDefinition,
  familyDefinitions,
  clean,
  platformName,
  statePartner,
} from '../data/store';
import { route, updateQuery, go } from '../data/router';
import type { Definition, Platform } from '../data/types';
import { metrics, flatten, locationOf, number, isStack } from '../specs/measurements';
import { exportComponent } from '../specs/exports';
import { resolve } from '../specs/materials.js';
import G from '../rendering/geometry.js';
import { renderScene, type Matrix } from '../rendering/scene';
import LivePreview from '../components/LivePreview.vue';
import MaterialPanel from '../components/MaterialPanel.vue';
const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ block: 'start' });
const familyID = computed(() => route.value.path.split('/')[2] ?? '');
const base = computed(
  () =>
    byID.get(route.value.query.get('v') ?? '') ??
    defaultDefinition(familyID.value, (route.value.query.get('platform') ?? 'ios') as Platform),
);
const transient = ref<Definition | null>(null);
const current = computed(() => transient.value ?? base.value);
const selectedLayer = ref(''),
  internal = ref(false),
  filter = ref(''),
  page = ref(0),
  tab = ref(route.value.query.get('tab') ?? 'specs');
const family = computed(() => database.value?.families.find((f) => f.id === current.value?.family));
const all = computed(() =>
  current.value ? familyDefinitions(current.value.family, current.value.platform) : [],
);
const candidates = computed(() =>
  all.value.filter(
    (c) =>
      (internal.value || !c.internal) &&
      clean(c.name).toLowerCase().includes(filter.value.toLowerCase()),
  ),
);
const visible = computed(() => candidates.value.slice(page.value * 15, (page.value + 1) * 15));
const nodes = computed(() => (current.value ? flatten(current.value.root) : []));
const node = computed(
  () => nodes.value.find((n) => n.node.id === selectedLayer.value)?.node ?? current.value?.root,
);
const geometry = computed(() =>
  current.value
    ? G.diagram(
        current.value,
        {
          dimensions: true,
          padding: true,
          gaps: true,
          boxes: false,
          selected: selectedLayer.value,
          appearance: current.value.facets.appearance,
          renderIllustration: (viewport: { width: number; height: number; placement: Matrix }) =>
            renderScene(current.value!, { ...viewport, background: 'plain' }),
        },
        720,
        300,
      )
    : '',
);
const paired = computed(() =>
  current.value
    ? statePartner(current.value, !/Pressed|Clicked/.test(current.value.name))
    : undefined,
);
const activeGlass = (c: Definition) =>
  resolve(c).records.some(
    (r: any) => !r.hidden && r.recipe.blurs?.some((b: any) => b.type === 4 && b.isEnabled),
  );
const heroTitle = computed(() => family.value?.zh ?? '组件定义');
function select(c: Definition) {
  transient.value = null;
  selectedLayer.value = '';
  if (c.family !== familyID.value) go('/components/' + c.family, { v: c.id });
  else updateQuery({ v: c.id });
}
function setPlatform(p: Platform) {
  const c = defaultDefinition(current.value?.family ?? familyID.value, p);
  if (c) select(c);
}
watch(
  () => route.value.query.get('v'),
  () => {
    transient.value = null;
    selectedLayer.value = '';
  },
);
watch(familyID, () => {
  filter.value = '';
  page.value = 0;
  tab.value = 'specs';
  internal.value = false;
});
watch(filter, () => (page.value = 0));
watch(current, (c) => {
  if (c) document.title = `${family.value?.zh ?? clean(c.name)} — HIG Spec`;
});
</script>
<template>
  <article v-if="current" class="detail-page">
    <div class="breadcrumbs"><a href="#/components">组件</a><span>/</span>{{ heroTitle }}</div>
    <header class="detail-heading">
      <div>
        <span class="eyebrow">{{ family?.name }}</span>
        <h1>{{ heroTitle }}</h1>
      </div>
      <div class="choice">
        <button
          v-for="p in family?.platforms ?? [current.platform]"
          :key="p"
          :class="{ selected: current.platform === p }"
          @click="setPlatform(p)"
        >
          {{ platformName(p) }}
        </button>
      </div>
    </header>
    <div class="detail-toolbar">
      <label class="grow"
        >变体<select
          :value="base?.id"
          @change="select(byID.get(($event.target as HTMLSelectElement).value)!)"
          aria-label="组件变体"
        >
          <option
            v-for="c in all.filter((d) => internal || !d.internal || d.id === base?.id)"
            :key="c.id"
            :value="c.id"
          >
            {{ clean(c.name).split('/').slice(1).join(' / ') }}
          </option>
        </select></label
      ><label class="checkbox small"><input type="checkbox" v-model="internal" />子部件</label>
      <div class="export-menu">
        <button class="button quiet" @click="exportComponent(current, 'json')">JSON ↓</button
        ><button class="button quiet" @click="exportComponent(current, 'md')">MD ↓</button
        ><button class="button quiet" @click="exportComponent(current, 'rs')">Rust ↓</button>
      </div>
    </div>
    <LivePreview :component="current" @state="transient = $event" @select="select" />
    <div class="under-preview">
      <span>{{ clean(current.name).split('/').slice(-2).join(' / ') }}</span
      ><button
        v-if="paired && paired.id !== current.id"
        class="text-button"
        @click="select(paired)"
      >
        {{ /Pressed|Clicked/.test(current.name) ? '查看静止态' : '查看按压态与玻璃参数' }} ↗
      </button>
    </div>
    <nav class="tabbar" aria-label="组件页面">
      <button
        v-for="[v, l] in [
          ['specs', '规格'],
          ['variants', '变体'],
          ['source', '来源'],
        ]"
        :key="v"
        @click="
          tab = v;
          updateQuery({ tab: v });
        "
        :class="{ active: tab === v }"
      >
        {{ l }}
      </button>
    </nav>
    <div v-if="tab === 'specs'" class="spec-columns">
      <div class="spec-body">
        <section id="dimensions" class="spec-section">
          <div class="section-heading">
            <h2>尺寸与间距</h2>
            <span class="muted small">pt · 1×</span>
          </div>
          <div class="metric-strip">
            <div>
              <span>宽度</span><strong>{{ number(current.root.f[2]) }}<small>pt</small></strong>
            </div>
            <div>
              <span>高度</span><strong>{{ number(current.root.f[3]) }}<small>pt</small></strong>
            </div>
            <div v-if="isStack(current.root)">
              <span>Padding · 上右下左</span
              ><strong class="compact-number">{{
                current.root.padding?.map(number).join(' / ') ?? '—'
              }}</strong>
            </div>
          </div>
          <div class="anatomy" :data-appearance="current.facets.appearance" v-html="geometry"></div>
          <div class="inspector">
            <label
              >部件<select v-model="selectedLayer" aria-label="几何图层">
                <option value="">外容器</option>
                <option v-for="{ node: n, depth } in nodes.slice(1)" :key="n.id" :value="n.id">
                  {{ '　'.repeat(depth - 1) + clean(n.name) }}{{ n.hidden ? '（隐藏）' : '' }}
                </option>
              </select></label
            >
            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>参数</th>
                    <th>值</th>
                    <th>字段</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="[k, v, s] in metrics(node!)" :key="k">
                    <td>{{ k }}</td>
                    <td>
                      <code>{{ v }}</code>
                    </td>
                    <td class="muted mono">{{ s }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <a
              v-if="node?.symbolID && node.type === 'symbolInstance'"
              class="text-button"
              :href="
                '#/definition?v=' +
                encodeURIComponent(
                  database!.components.find(
                    (c) => c.platform === current!.platform && c.symbolID === node!.symbolID,
                  )?.id ?? '',
                )
              "
              >查看子部件规格 ↗</a
            >
          </div>
        </section>
        <MaterialPanel :component="current" @select="select" />
        <section id="layout" class="spec-section">
          <h2>部件布局</h2>
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>部件</th>
                  <th>X</th>
                  <th>Y</th>
                  <th>宽</th>
                  <th>高</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="{ node: n, depth } in nodes" :key="n.id" :class="{ dim: n.hidden }">
                  <td>
                    <button
                      class="text-button layer-name"
                      @click="selectedLayer = n.id"
                      :style="{ paddingLeft: depth * 12 + 'px' }"
                    >
                      {{ clean(n.name).split('/').pop() }}
                    </button>
                  </td>
                  <td v-for="(v, i) in n.f" :key="i">
                    <code>{{ number(v) }}</code>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <aside class="toc">
        <span>本页内容</span
        ><a href="#dimensions" @click.prevent="scrollTo('dimensions')">尺寸与间距</a
        ><a href="#materials" @click.prevent="scrollTo('materials')">材质</a
        ><a href="#layout" @click.prevent="scrollTo('layout')">部件布局</a>
      </aside>
    </div>
    <section v-else-if="tab === 'variants'" class="spec-section">
      <div class="section-heading">
        <h2>变体对照</h2>
        <input
          type="search"
          v-model="filter"
          placeholder="搜索状态、尺寸或样式"
          aria-label="搜索变体"
        />
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>变体</th>
              <th>宽 × 高</th>
              <th>玻璃</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in visible" :key="c.id">
              <td>
                <button class="text-button" @click="select(c)">
                  {{ clean(c.name).split('/').slice(1).join(' / ') }}
                </button>
              </td>
              <td class="mono">{{ number(c.root.f[2]) }} × {{ number(c.root.f[3]) }}</td>
              <td>
                <span v-if="activeGlass(c)" class="tag positive">Liquid Glass</span
                ><span v-else class="muted">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="pagination">
        <span>{{ candidates.length }} 个变体</span
        ><button class="button quiet" :disabled="page === 0" @click="page--">上一页</button
        ><span>{{ page + 1 }} / {{ Math.max(1, Math.ceil(candidates.length / 15)) }}</span
        ><button
          class="button quiet"
          :disabled="(page + 1) * 15 >= candidates.length"
          @click="page++"
        >
          下一页
        </button>
      </div>
    </section>
    <section v-else class="spec-section">
      <h2>设计来源</h2>
      <p>{{ database?.sources.find((s) => s.id === current!.platform)?.filename }}</p>
      <p class="small muted">设计文件保存的尺寸与材质参数。Web 预览为近似实现。</p>
      <dl class="source-details">
        <dt>组件</dt>
        <dd>{{ clean(current.name) }}</dd>
        <dt>图层 ID</dt>
        <dd>{{ current.root.id }}</dd>
        <dt>位置</dt>
        <dd>{{ locationOf(current) }}</dd>
      </dl>
      <details class="disclosure">
        <summary>组件 JSON</summary>
        <pre>{{ JSON.stringify(current, null, 2) }}</pre>
      </details>
    </section>
  </article>
  <div v-else class="empty">
    <h1>未找到组件</h1>
    <a href="#/components">返回组件目录</a>
  </div>
</template>
