<template>
  <div
    class="space-y-5"
    :aria-label="t('dashboard.platformStatisticsLoading')"
    aria-busy="true"
  >
    <header class="space-y-3 pb-2">
      <SkeletonBlock class="block h-6 w-24 rounded-full" />
      <SkeletonBlock class="block h-9 w-44 rounded" />
      <SkeletonBlock class="block h-4 w-full max-w-md rounded" />
    </header>

    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <SurfacePanel
        v-for="index in 4"
        :key="index"
        as="article"
        padding="lg"
        class="min-h-32 space-y-4"
      >
        <SkeletonBlock class="block h-3 w-20 rounded" />
        <SkeletonBlock class="block h-8 w-24 rounded" />
        <SkeletonBlock class="block h-4 w-32 rounded" />
      </SurfacePanel>
    </section>

    <section
      class="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)]"
    >
      <div class="grid gap-5">
        <SurfacePanel as="section" padding="lg">
          <div class="flex items-center justify-between gap-4">
            <div class="space-y-2">
              <SkeletonBlock class="block h-5 w-32 rounded" />
              <SkeletonBlock class="block h-3.5 w-44 rounded" />
            </div>
            <SkeletonBlock class="h-7 w-16 rounded-full" />
          </div>
          <SurfacePanel variant="inset" class="mt-4 space-y-px overflow-hidden">
            <div
              v-for="row in 4"
              :key="row"
              class="flex items-center gap-4 px-4 py-3"
            >
              <SkeletonBlock class="h-4 w-24 rounded" />
              <SkeletonBlock class="h-2.5 flex-1 rounded-full" />
              <SkeletonBlock class="h-4 w-10 rounded" />
            </div>
          </SurfacePanel>
        </SurfacePanel>

        <SurfacePanel as="section" padding="lg">
          <div class="flex items-center justify-between gap-4">
            <div class="space-y-2">
              <SkeletonBlock class="block h-5 w-32 rounded" />
              <SkeletonBlock class="block h-3.5 w-48 rounded" />
            </div>
            <SkeletonBlock class="h-7 w-20 rounded-full" />
          </div>
          <SurfacePanel variant="inset" class="mt-4 space-y-px overflow-hidden">
            <div
              v-for="row in 3"
              :key="row"
              class="grid grid-cols-3 items-center gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_5rem_5rem_4rem]"
            >
              <SkeletonBlock class="col-span-3 h-4 rounded sm:col-span-1" />
              <SkeletonBlock class="h-4 rounded" />
              <SkeletonBlock class="h-4 rounded" />
              <SkeletonBlock class="h-4 rounded" />
            </div>
          </SurfacePanel>
        </SurfacePanel>
      </div>

      <div class="grid gap-5">
        <SurfacePanel
          v-for="index in 2"
          :key="index"
          as="section"
          padding="lg"
          class="min-h-52"
        >
          <div class="space-y-2">
            <SkeletonBlock class="block h-5 w-32 rounded" />
            <SkeletonBlock class="block h-3.5 w-40 rounded" />
          </div>
          <div class="mt-6 space-y-5">
            <div v-for="row in 3" :key="row" class="flex items-center gap-3">
              <SkeletonBlock class="h-4 w-14 rounded" />
              <SkeletonBlock class="h-2.5 flex-1 rounded-full" />
              <SkeletonBlock class="h-5 w-10 rounded" />
            </div>
          </div>
        </SurfacePanel>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "@/i18n";
import SurfacePanel from "@/components/ui/molecules/SurfacePanel.vue";
import SkeletonBlock from "@/components/ui/atoms/SkeletonBlock.vue";

const { t } = useI18n();
</script>
