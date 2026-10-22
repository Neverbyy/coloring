<script setup lang="ts">
const model = defineModel<string[]>({ required: true })

const options = useCountryOptions()
const countryName = useCountryName()
const available = computed(() => options.value.filter(option => !model.value.includes(option.code)))

const adding = ref('')
watch(adding, (code) => {
  if (!code) return
  model.value = [...model.value, code]
  adding.value = ''
})

function remove(code: string) {
  model.value = model.value.filter(item => item !== code)
}
</script>

<template>
  <div class="country-picker">
    <ul v-if="model.length" class="admin-chips">
      <AdminChip v-for="code in model" :key="code" :label="countryName(code)" :country="code" @remove="remove(code)" />
    </ul>
    <CountrySelect v-model="adding" :options="available" placeholder="Добавить страну…" label="Добавить страну" compact />
  </div>
</template>

<style scoped lang="scss">
.country-picker {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
