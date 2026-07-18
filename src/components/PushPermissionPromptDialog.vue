<template>
  <DialogShell
    :open="open"
    labelled-by="push-permission-title"
    described-by="push-permission-description"
    surface-class="dialog-card"
    z-index-class="z-[90]"
    @close="emit('dismiss')"
  >
    <div class="flex items-start gap-4">
      <IconTile tone="info" aria-hidden="true">
        <AppIcon name="bell" :size="6" />
      </IconTile>
      <DialogHeading
        class="flex-1"
        flush-title
        title-id="push-permission-title"
        :title="
          t(
            mode === 'repair'
              ? 'app.install.reEnablePushNotifications'
              : 'app.install.turnOnPushNotifications',
          )
        "
        description-id="push-permission-description"
        :description="
          t(
            mode === 'repair'
              ? 'app.install.deviceNotificationLinkRequiresRefresh'
              : 'app.install.proposalNotificationBenefits',
          )
        "
      />
    </div>

    <DialogActionRow>
      <AppButton variant="secondary" :disabled="busy" @click="emit('dismiss')">
        {{ t("common.later") }}
      </AppButton>
      <AppButton
        variant="primary"
        :disabled="busy"
        data-autofocus
        @click="emit('enable')"
      >
        <BusyButtonContent
          :busy="busy"
          :label="
            t(
              mode === 'repair'
                ? 'app.install.reEnable'
                : 'app.install.turnOnNotifications',
            )
          "
          :busy-label="t('app.install.processing')"
        />
      </AppButton>
    </DialogActionRow>
  </DialogShell>
</template>

<script setup lang="ts">
import DialogShell from "@/components/ui/organisms/DialogShell.vue";
import DialogActionRow from "@/components/ui/molecules/DialogActionRow.vue";
import DialogHeading from "@/components/ui/molecules/DialogHeading.vue";
import BusyButtonContent from "@/components/ui/atoms/BusyButtonContent.vue";
import AppButton from "@/components/ui/atoms/AppButton.vue";
import IconTile from "@/components/ui/atoms/IconTile.vue";
import AppIcon from "@/components/ui/atoms/AppIcon.vue";
import { useI18n } from "@/i18n";

const props = defineProps<{
  busy: boolean;
  mode?: "permission" | "repair";
  open: boolean;
}>();
const { t } = useI18n();

const emit = defineEmits<{
  dismiss: [];
  enable: [];
}>();
</script>
