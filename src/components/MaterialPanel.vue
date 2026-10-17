<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Definition } from '../data/types';
import { resolve } from '../specs/materials.js';
import { glassVariants, statePartner, clean } from '../data/store';
import { download } from '../specs/exports';
import RecipePanel from './RecipePanel.vue';
const props = defineProps<{ component: Definition }>();
const emit = defineEmits<{ select: [Definition] }>();
const result = computed(() => resolve(props.component));
const showHidden = ref(false),
  index = ref(0);
const rows = computed(() =>
  result.value.records
    .filter((r: any) => showHidden.value || !r.hidden)
    .slice()
    .sort(
      (a: any, b: any) =>
        Number(!!b.recipe.blurs?.some((v: any) => v.isEnabled && v.type === 4)) -
        Number(!!a.recipe.blurs?.some((v: any) => v.isEnabled && v.type === 4)),
    ),
);
const record = computed(() => rows.value[index.value] ?? rows.value[0]);
const related = computed(() => {
  const p = statePartner(props.component, true);
  return p && p.id !== props.component.id
    ? [p]
    : glassVariants(props.component)
        .filter((d) => d.id !== props.component.id)
        .slice(0, 4);
});
watch(
  () => props.component.id,
  () => {
    index.value = 0;
    showHidden.value = false;
  },
);
</script>
<template>
  <section id="materials" class="spec-section">
    <div class="section-heading">
      <h2>材质</h2>
      <a href="#/materials/liquid-glass">Liquid Glass ↗</a>
    </div>
    <div
      v-if="
        rows.length &&
        !rows.some((r: any) => r.recipe.blurs?.some((b: any) => b.isEnabled && b.type === 4)) &&
        related.length
      "
      class="empty-material"
    >
      <p>玻璃效果位于交互态或子部件。</p>
      <div class="inline-links">
        <button v-for="c in related" :key="c.id" class="button quiet" @click="emit('select', c)">
          {{ clean(c.name).split('/').slice(-2).join(' / ') }} ↗
        </button>
      </div>
    </div>
    <template v-if="rows.length"
      ><div class="field-row">
        <label class="grow"
          >图层<select v-model.number="index" aria-label="材质图层">
            <option v-for="(r, i) in rows" :key="i" :value="i">
              {{ r.chain.map((n: any) => n.name).join(' / ') }}{{ r.chain.length ? ' / ' : ''
              }}{{ r.nodeName }}{{ r.hidden ? '（隐藏）' : '' }}
            </option>
          </select></label
        ><button
          class="button quiet"
          @click="download(record, 'material-' + record.nodeID + '.json')"
        >
          导出 JSON
        </button>
      </div>
      <div class="material-identity">
        <span
          class="tag"
          :class="{ positive: record.recipe.blurs?.some((b: any) => b.type === 4 && b.isEnabled) }"
          >{{ record.shared ? '共享材质' : '局部材质' }}</span
        ><a
          v-if="record.shared"
          :href="`#/materials/liquid-glass?platform=${component.platform}&style=${record.shared.id}`"
          >{{ record.shared.name.replace('Liquid Glass/', '') }} ↗</a
        ><span v-else>{{ record.nodeName }}</span>
      </div>
      <RecipePanel :recipe="record.recipe" />
      <details class="disclosure">
        <summary>参数来源</summary>
        <p class="small">{{ clean(record.ownerName) }}</p>
        <pre>{{
          JSON.stringify(
            {
              layer: record.location,
              node: record.nodeID,
              shared: record.shared?.id,
              localDifference: record.localDifference,
              overrides: record.overrides,
            },
            null,
            2,
          )
        }}</pre>
      </details></template
    >
    <div v-else class="empty-material">
      <h3>当前静态状态没有玻璃效果</h3>
      <p v-if="related.length">此组件的玻璃效果位于以下交互状态或子部件。</p>
      <div class="inline-links">
        <button v-for="c in related" :key="c.id" class="button quiet" @click="emit('select', c)">
          {{ clean(c.name).split('/').slice(-2).join(' / ') }} ↗
        </button>
      </div>
    </div>
    <label v-if="result.records.some((r: any) => r.hidden)" class="checkbox small"
      ><input type="checkbox" v-model="showHidden" />显示隐藏图层</label
    >
    <details v-if="result.warnings.length" class="disclosure">
      <summary>部分引用未解析（{{ result.warnings.length }}）</summary>
      <pre>{{ result.warnings.join('\n') }}</pre>
    </details>
  </section>
</template>
