<template>
  <UserAvatar
    :photo-url="profile?.photoUrl ?? null"
    :name="profile?.displayName ?? ''"
    :size="size"
    :alt-text="altText"
  />
</template>

<script setup lang="ts">
import UserAvatar from '@/components/ui/atoms/UserAvatar.vue';
import { useAuthorProfile } from '@/composables/useAuthorProfile';

const props = withDefaults(defineProps<{
  altText?: string;
  authorUid: string | null;
  size?: 'sm' | 'md' | 'lg';
}>(), {
  altText: 'settings.userAvatar',
  size: 'md',
});

const profile = useAuthorProfile(() => props.authorUid);
</script>
