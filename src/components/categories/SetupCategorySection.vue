<template>
  <section class="space-y-3">
    <SectionHeader :title="title" :description="description">
      <template #trailing>
        <div class="flex shrink-0 flex-wrap items-center justify-end gap-3">
          <slot name="header-actions" />
          <AppButton type="button" variant="secondary" :disabled="disabled" @click="emit('add')">
            {{ t('categoryAdmin.addCategory') }}
          </AppButton>
        </div>
      </template>
    </SectionHeader>

    <fieldset
      class="min-w-0 border-0 p-0 transition-opacity"
      :class="disabled ? 'opacity-45' : ''"
      :disabled="disabled"
      :aria-disabled="disabled || undefined"
    >
      <div class="grid items-start gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <CategorySelectorList
          v-model:selected-index="selectedIndex"
          :categories="model"
          show-default
        />

        <CategoryEditorCard
          v-if="selectedCategory"
          v-model="model[selectedIndex]"
          flat
          default-control
          :field-id="`setup-${kind}-${selectedIndex}`"
          :kind="kind"
          :removable="model.length > 1"
          @make-default="makeDefault"
          @remove="removeSelected"
        />
      </div>
    </fieldset>
  </section>
</template>

<script setup lang="ts" generic="T extends IssueCategoryDraft | FacilityCategoryDraft">
import { computed, ref, watch } from 'vue';
import CategoryEditorCard from '@/components/categories/CategoryEditorCard.vue';
import CategorySelectorList from '@/components/categories/CategorySelectorList.vue';
import AppButton from '@/components/ui/atoms/AppButton.vue';
import SectionHeader from '@/components/ui/molecules/SectionHeader.vue';
import { useI18n } from '@/i18n';
import type { FacilityCategoryDraft, IssueCategoryDraft } from '@/types/categories';

defineProps<{
  description: string;
  disabled?: boolean;
  kind: 'facility' | 'issue';
  title: string;
}>();
const model = defineModel<T[]>({ required: true });
const emit = defineEmits<{ add: [] }>();
const { t } = useI18n();
const selectedIndex = ref(0);
const selectedCategory = computed(() => model.value[selectedIndex.value] ?? null);

watch(() => model.value.length, (length) => {
  if (selectedIndex.value >= length) selectedIndex.value = Math.max(0, length - 1);
});

function removeSelected() {
  if (model.value.length <= 1) return;
  const removedWasDefault = model.value[selectedIndex.value]?.isDefault === true;
  model.value.splice(selectedIndex.value, 1);
  if (removedWasDefault && model.value.length > 0) makeDefault(0);
}

function makeDefault(index = selectedIndex.value) {
  model.value.forEach((category, categoryIndex) => { category.isDefault = categoryIndex === index; });
}
</script>
