<template>
  <q-page padding>
    <!-- Header row -->
    <div class="row items-center justify-between q-mb-md">
      <div class="text-h5 text-weight-bold">{{ t('staff.title') }}</div>
      <q-btn
        v-if="tenantStore.hasPermission('user.invite')"
        :label="t('staff.inviteStaff')"
        color="primary"
        unelevated
        icon="person_add"
        style="min-height: 44px"
        @click="openInviteDialog"
      />
    </div>

    <!-- Staff table -->
    <q-table
      :rows="staffList"
      :columns="columns"
      row-key="id"
      flat
      bordered
      :loading="isLoading"
      :rows-per-page-options="[20, 50, 100]"
      :row-class="(row: StaffUser) => !row.isActive ? 'text-grey-5' : ''"
    >
      <template #body-cell-isActive="props">
        <q-td :props="props">
          <q-badge :color="props.value ? 'positive' : 'grey-5'">
            {{ props.value ? t('staff.active') : t('staff.inactive') }}
          </q-badge>
        </q-td>
      </template>

      <template #body-cell-role="props">
        <q-td :props="props">
          {{ props.row.role?.name ?? '—' }}
        </q-td>
      </template>

      <template #body-cell-actions="props">
        <q-td :props="props">
          <template v-if="tenantStore.hasPermission('user.manage')">
            <q-btn
              v-if="props.row.isActive"
              flat dense round
              icon="person_off"
              color="negative"
              :title="t('staff.deactivate')"
              @click="confirmDeactivate(props.row)"
            />
            <q-btn
              v-else
              flat dense round
              icon="person_add_alt_1"
              color="positive"
              :title="t('staff.reactivate')"
              @click="confirmReactivate(props.row)"
            />
          </template>
        </q-td>
      </template>

      <template #no-data>
        <div class="full-width text-center q-pa-xl text-grey-6">
          <q-icon name="group" size="48px" class="q-mb-md" />
          <div>{{ t('staff.noStaff') }}</div>
        </div>
      </template>
    </q-table>

    <!-- Invite dialog -->
    <q-dialog v-model="inviteDialog" persistent>
      <q-card style="min-width: 360px">
        <q-card-section>
          <div class="text-subtitle1 text-weight-bold">{{ t('staff.inviteStaff') }}</div>
        </q-card-section>

        <q-card-section class="q-pt-none q-gutter-y-sm">
          <q-input
            v-model="inviteForm.email"
            :label="t('staff.email')"
            type="email"
            outlined
            dense
            autofocus
            :rules="[val => !!val || t('common.required')]"
          />

          <q-select
            v-model="inviteForm.roleId"
            :label="t('staff.role')"
            :options="roleOptions"
            option-value="id"
            option-label="name"
            emit-value
            map-options
            outlined
            dense
            :loading="isLoadingRoles"
            :rules="[val => !!val || t('common.required')]"
          />

          <q-field label="Branch" stack-label outlined class="q-mb-md">
            <template #control>
              <div class="self-center full-width">{{ tenantStore.branchName ?? tenantStore.branchId }}</div>
            </template>
          </q-field>
        </q-card-section>

        <!-- Invite link shown after successful invite -->
        <q-card-section v-if="inviteLink" class="q-pt-none">
          <div class="text-caption text-grey-6 q-mb-xs">{{ t('staff.inviteLinkCopied') }}</div>
          <q-input
            :model-value="inviteLink"
            outlined
            dense
            readonly
            class="full-width"
          >
            <template #append>
              <q-btn flat dense icon="content_copy" @click="() => navigator.clipboard.writeText(inviteLink)" />
            </template>
          </q-input>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat :label="t('common.cancel')" v-close-popup :disable="isInviting" />
          <q-btn
            v-if="!inviteLink"
            :label="t('staff.sendInvite')"
            color="primary"
            unelevated
            :loading="isInviting"
            @click="doInvite"
          />
          <q-btn
            v-else
            :label="t('common.close')"
            color="primary"
            unelevated
            v-close-popup
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Deactivate confirm dialog -->
    <q-dialog v-model="deactivateDialog">
      <q-card style="min-width: 300px">
        <q-card-section>
          <div class="text-subtitle1">{{ t('staff.confirmDeactivate') }}</div>
          <div class="text-caption text-grey-7 q-mt-xs">{{ selectedStaff?.email }}</div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="t('common.cancel')" v-close-popup />
          <q-btn
            :label="t('staff.deactivate')"
            color="negative"
            unelevated
            :loading="isDeactivating"
            @click="doDeactivate"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Reactivate confirm dialog -->
    <q-dialog v-model="reactivateDialog">
      <q-card style="min-width: 300px">
        <q-card-section>
          <div class="text-subtitle1">{{ t('staff.confirmReactivate') }}</div>
          <div class="text-caption text-grey-7 q-mt-xs">{{ selectedStaff?.email }}</div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="t('common.cancel')" v-close-popup />
          <q-btn
            :label="t('staff.reactivate')"
            color="positive"
            unelevated
            :loading="isReactivating"
            @click="doReactivate"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'
import { usersApi } from '@/api/users.api'
import { useTenantStore } from '@/stores/tenant.store'
import type { StaffUser, Role } from '@/api/users.api'

const { t } = useI18n()
const $q = useQuasar()
const tenantStore = useTenantStore()

const staffList = ref<StaffUser[]>([])
const isLoading = ref(false)
const inviteDialog = ref(false)
const deactivateDialog = ref(false)
const reactivateDialog = ref(false)
const isInviting = ref(false)
const isDeactivating = ref(false)
const isReactivating = ref(false)
const isLoadingRoles = ref(false)
const selectedStaff = ref<StaffUser | null>(null)
const roleOptions = ref<Role[]>([])

const inviteForm = ref({
  email: '',
  roleId: '',
})
const inviteLink = ref('')

const columns = [
  { name: 'name', label: t('staff.name'), field: 'name', sortable: true, align: 'left' as const },
  { name: 'email', label: t('staff.email'), field: 'email', sortable: true, align: 'left' as const },
  { name: 'role', label: t('staff.role'), field: 'role', align: 'left' as const },
  { name: 'isActive', label: t('staff.status'), field: 'isActive', sortable: true, align: 'center' as const },
  { name: 'actions', label: '', field: 'actions', align: 'right' as const },
]

async function loadStaff() {
  isLoading.value = true
  try {
    const res = await usersApi.listUsers()
    staffList.value = (res.data as unknown as { users: StaffUser[] }).users ?? (res.data as unknown as StaffUser[])
  } catch {
    $q.notify({ type: 'negative', message: t('common.error') })
  } finally {
    isLoading.value = false
  }
}

async function loadRoles() {
  isLoadingRoles.value = true
  try {
    const res = await usersApi.listRoles()
    roleOptions.value = (res.data as unknown as { roles: Role[] }).roles ?? (res.data as unknown as Role[])
  } catch {
    $q.notify({ type: 'negative', message: t('common.error') })
  } finally {
    isLoadingRoles.value = false
  }
}

function openInviteDialog() {
  inviteForm.value = { email: '', roleId: '' }
  inviteLink.value = ''
  inviteDialog.value = true
  if (roleOptions.value.length === 0) loadRoles()
}

async function doInvite() {
  if (!inviteForm.value.email || !inviteForm.value.roleId) {
    $q.notify({ type: 'warning', message: t('common.required') })
    return
  }
  isInviting.value = true
  try {
    const res = await usersApi.inviteUser({
      email: inviteForm.value.email,
      roleId: inviteForm.value.roleId,
      branchId: tenantStore.branchId ?? '',
    })
    inviteLink.value = `${window.location.origin}/accept-invite/${res.data.inviteToken}`
    await navigator.clipboard.writeText(inviteLink.value).catch(() => {})
    $q.notify({ type: 'positive', message: t('staff.inviteSent') + ' ' + t('staff.inviteLinkCopied') })
    await loadStaff()
  } catch {
    $q.notify({ type: 'negative', message: t('common.error') })
  } finally {
    isInviting.value = false
  }
}

function confirmDeactivate(staff: StaffUser) {
  selectedStaff.value = staff
  deactivateDialog.value = true
}

async function doDeactivate() {
  if (!selectedStaff.value) return
  isDeactivating.value = true
  try {
    await usersApi.deactivateUser(selectedStaff.value.id)
    $q.notify({ type: 'positive', message: t('staff.deactivatedSuccess') })
    deactivateDialog.value = false
    await loadStaff()
  } catch {
    $q.notify({ type: 'negative', message: t('common.error') })
  } finally {
    isDeactivating.value = false
  }
}

function confirmReactivate(staff: StaffUser) {
  selectedStaff.value = staff
  reactivateDialog.value = true
}

async function doReactivate() {
  if (!selectedStaff.value) return
  isReactivating.value = true
  try {
    const res = await usersApi.reactivateUser(selectedStaff.value.id)
    const inviteUrl = `${window.location.origin}/accept-invite/${res.data.inviteToken}`
    await navigator.clipboard.writeText(inviteUrl)
    $q.notify({ type: 'positive', message: t('staff.reactivateSuccess') + ' ' + t('staff.inviteLinkCopied') })
    reactivateDialog.value = false
    await loadStaff()
  } catch {
    $q.notify({ type: 'negative', message: t('common.error') })
  } finally {
    isReactivating.value = false
  }
}

onMounted(loadStaff)
</script>
