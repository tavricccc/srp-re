import { computed, ref } from 'vue';

type DialogStepDirection = 'backward' | 'forward';

export function useDialogStepMotion(initialStep = 1) {
  const step = ref(initialStep);
  const direction = ref<DialogStepDirection>('forward');

  const stepMotionStyle = computed(() => ({
    '--dialog-step-enter-x': direction.value === 'forward' ? '2%' : '-2%',
    '--dialog-step-leave-x': direction.value === 'forward' ? '-2%' : '2%',
  }));

  function goToStep(nextStep: number) {
    direction.value = nextStep >= step.value ? 'forward' : 'backward';
    step.value = nextStep;
  }

  function resetStep() {
    direction.value = 'forward';
    step.value = initialStep;
  }

  return {
    goToStep,
    resetStep,
    step,
    stepMotionStyle,
  };
}
