<script setup lang="ts">
import { computed } from 'vue';
import { blendNames } from '../rendering/surface';
import { number } from '../specs/measurements';
const props = defineProps<{ recipe: any; title?: string }>();
const blurs = computed(
  () => props.recipe?.blurs ?? (props.recipe?.blur ? [props.recipe.blur] : []),
);
const names: Record<string, string> = {
  radius: '模糊半径',
  distortion: '畸变',
  depth: '深度',
  saturation: '饱和度',
  brightness: '亮度',
  chromaticAberrationMultiplier: '色差',
  skipLightingEffects: '跳过内置光照',
  extraSamplingRegion: '额外采样区域',
  isCustomGlass: '自定义玻璃',
  isEnabled: '启用',
  isProgressive: '渐进',
  layeringType: '分层类型',
  center: '中心',
  motionAngle: '运动角度',
  type: '效果类型',
};
const fields = [
  'radius',
  'distortion',
  'depth',
  'saturation',
  'brightness',
  'chromaticAberrationMultiplier',
  'skipLightingEffects',
  'extraSamplingRegion',
  'isCustomGlass',
  'isEnabled',
  'isProgressive',
  'layeringType',
  'type',
  'center',
  'motionAngle',
];
const stacks = computed(() =>
  [
    ['fills', '填充'],
    ['shadows', '阴影'],
    ['innerShadows', '内阴影'],
    ['borders', '边框'],
  ].filter(([key]) => props.recipe?.[key]?.length),
);
const modes = blendNames;
function value(v: any) {
  return typeof v === 'boolean' ? (v ? '开启' : '关闭') : number(v);
}
function color(c: any) {
  return c
    ? `rgba(${Math.round(c.red * 255)}, ${Math.round(c.green * 255)}, ${Math.round(c.blue * 255)}, ${number(c.alpha)})`
    : '—';
}
</script>
<template>
  <div class="recipe-panel">
    <div v-for="(blur, i) in blurs" :key="i" class="optics">
      <div class="subheading">
        <h3>{{ title ?? (blur.type === 4 ? '玻璃参数' : '模糊参数') }}</h3>
        <span class="tag" :class="{ positive: blur.isEnabled }">{{
          blur.isEnabled ? '启用' : '未启用'
        }}</span>
      </div>
      <div class="optics-grid">
        <div
          v-for="key in [
            'radius',
            'distortion',
            'depth',
            'saturation',
            'brightness',
            'chromaticAberrationMultiplier',
          ]"
          :key="key"
        >
          <span>{{ names[key] }}</span
          ><strong>{{ number(blur[key]) }}</strong
          ><code>{{ key === 'chromaticAberrationMultiplier' ? 'chromaticAberration' : key }}</code>
        </div>
      </div>
      <details class="disclosure">
        <summary>全部参数</summary>
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
              <tr
                v-for="key in [
                  ...fields,
                  ...Object.keys(blur).filter((k) => k !== '_class' && !fields.includes(k)),
                ]"
                :key="key"
              >
                <td>{{ names[key] ?? key }}</td>
                <td>
                  <code>{{ value(blur[key]) }}</code>
                </td>
                <td class="muted mono">{{ key }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </div>
    <p v-if="!blurs.length" class="muted small">此样式使用填充与阴影。</p>
    <details v-for="[key, label] in stacks" :key="key" class="disclosure">
      <summary>
        {{ label }}
        <span class="muted">{{ recipe[key].filter((x: any) => x.isEnabled).length }} 项启用</span>
      </summary>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>层</th>
              <th>状态</th>
              <th>颜色</th>
              <th>合成</th>
              <th>不透明度</th>
              <template v-if="key.includes('hadow')"
                ><th>X</th>
                <th>Y</th>
                <th>Blur</th>
                <th>Spread</th></template
              >
              <th v-else>类型</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(e, i) in recipe[key]" :key="i" :class="{ dim: !e.isEnabled }">
              <td>{{ i }}<small v-if="e.isInnerShadow"> 内</small></td>
              <td>{{ e.isEnabled ? '启用' : '关闭' }}</td>
              <td>
                <span class="color-chip" :style="{ background: color(e.color) }"></span
                ><code>{{ color(e.color) }}</code>
              </td>
              <td>{{ modes[e.contextSettings?.blendMode] ?? e.contextSettings?.blendMode }}</td>
              <td>{{ number(e.contextSettings?.opacity) }}</td>
              <template v-if="key.includes('hadow')"
                ><td>{{ number(e.offsetX) }}</td>
                <td>{{ number(e.offsetY) }}</td>
                <td>{{ number(e.blurRadius) }}</td>
                <td>{{ number(e.spread) }}</td></template
              >
              <td v-else>{{ e.fillType === 1 ? '渐变' : number(e.fillType ?? e.position) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
    <details class="disclosure">
      <summary>完整参数 JSON</summary>
      <pre>{{ JSON.stringify(recipe, null, 2) }}</pre>
    </details>
  </div>
</template>
