<script setup lang="ts">
import { database } from '../data/store';
</script>
<template>
  <article class="reading">
    <header class="page-heading">
      <div class="eyebrow">REFERENCE</div>
      <h1>来源与单位</h1>
    </header>
    <section class="spec-section">
      <h2>如何读这份规格</h2>
      <p>
        尺寸以 1× 设计坐标（pt）显示。固定示例宽度不等于最小宽度；仅在设计图层明确使用自动布局时显示
        Padding 与 Gap。玻璃参数沿用设计文件原值，零值、关闭与未提供是不同状态。
      </p>
      <p>
        选择不同平台、状态和子部件，可以查看它们各自的尺寸与材质。预览使用独立的 Web
        折射效果，标注与导出保留原始参数。
      </p>
    </section>
    <section class="spec-section">
      <h2>设计文件</h2>
      <div v-for="s in database!.sources" :key="s.id" class="source-card">
        <h3>{{ s.platform }} {{ s.release }}</h3>
        <p>{{ s.filename }}</p>
        <details class="disclosure">
          <summary>版本与校验</summary>
          <dl class="source-details">
            <dt>Sketch</dt>
            <dd>{{ s.sketchVersion }}</dd>
            <dt>SHA-256</dt>
            <dd>{{ s.sha256 }}</dd>
          </dl>
        </details>
      </div>
      <a href="https://developer.apple.com/design/resources/" target="_blank" rel="noopener"
        >Apple Design Resources ↗</a
      >
    </section>
    <section class="spec-section">
      <h2>关于项目</h2>
      <p>
        HIG Spec 是独立的组件规格参考项目，与 Apple 无隶属关系。设计资源及相关名称归原权利方所有。
      </p>
      <a href="https://github.com/HIG-Spec/hig-spec.github.io" target="_blank" rel="noopener"
        >项目源码与反馈 ↗</a
      >
    </section>
  </article>
</template>
