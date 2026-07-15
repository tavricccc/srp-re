<template>
  <section class="mx-auto w-full max-w-5xl space-y-5 py-2 md:py-6">
    <div><h1 class="text-2xl font-semibold">角色管理</h1><p class="mt-1 text-sm text-ink-500">授予或撤銷校內使用者的管理權限</p></div>
    <input v-model="query" class="field" placeholder="搜尋使用者" aria-label="搜尋使用者" />
    <div v-if="loading" class="py-16 text-center text-sm text-ink-500">正在載入角色…</div>
    <EmptyStatePanel v-else-if="error" title="角色讀取失敗" :description="error" icon="warning" />
    <div v-else class="space-y-3">
      <article v-for="user in users" :key="user.uid" class="panel p-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3"><UserAvatar :photo-url="user.photoUrl" :name="user.name" size="sm" /><div><h2 class="text-sm font-bold">{{ user.name }}</h2><p class="text-xs text-ink-500">{{ user.uid }}</p></div></div>
          <div class="flex flex-wrap justify-end gap-2">
            <label v-for="role in roles" :key="role.code" class="flex items-center gap-2 rounded-full bg-ink-50 px-3 py-2 text-xs font-semibold dark:bg-ink-800"><input type="checkbox" :checked="user.roles.includes(role.code)" :disabled="savingUid === user.uid" @change="toggleRole(user, role.code)" />{{ role.label }}</label>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import EmptyStatePanel from '@/components/ui/EmptyStatePanel.vue';
import UserAvatar from '@/components/ui/UserAvatar.vue';
import { listRoleAssignments, setUserRoles, type AccessUser } from '@/services/access';
import type { RoleCode } from '@/services/session-role';
const roles: Array<{ code: RoleCode; label: string }> = [
  { code: 'platform-admin', label: '平台管理員' }, { code: 'proposal-manager', label: '提案管理' },
  { code: 'announcement-manager', label: '公告管理' }, { code: 'general-affairs', label: '總務處' },
];
const users = ref<AccessUser[]>([]); const query = ref(''); const loading = ref(false); const error = ref(''); const savingUid = ref('');
async function load() { loading.value = true; error.value = ''; try { users.value = await listRoleAssignments(query.value.trim()); } catch (caught) { error.value = caught instanceof Error ? caught.message : '讀取失敗。'; } finally { loading.value = false; } }
async function toggleRole(user: AccessUser, role: RoleCode) { savingUid.value = user.uid; const next = user.roles.includes(role) ? user.roles.filter((value) => value !== role) : [...user.roles, role]; try { user.roles = (await setUserRoles(user.uid, next)).roles; } catch (caught) { error.value = caught instanceof Error ? caught.message : '儲存失敗。'; } finally { savingUid.value = ''; } }
let timer = 0; watch(query, () => { window.clearTimeout(timer); timer = window.setTimeout(() => void load(), 300); }); onMounted(() => void load());
</script>
