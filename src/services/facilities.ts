import { invokeBackendAction } from '@/services/backend-action';
import { createRequestId } from '@/lib/request-id';
import type {
  FacilityCursor,
  FacilityInput,
  FacilityPageResult,
  FacilityRecord,
  FacilitySortOption,
  FacilityStatus,
  FacilitySummary,
} from '@/types';
import { toReadableBackendError } from '@/services/issues-core';

interface RawFacility extends Omit<FacilityRecord, 'closed_at' | 'created_at' | 'started_at' | 'updated_at'> {
  closed_at?: string | null;
  created_at?: string | null;
  started_at?: string | null;
  updated_at?: string | null;
}

function date(value: string | null | undefined) {
  return value ? new Date(value) : null;
}

function normalizeFacility(value: RawFacility): FacilityRecord {
  return {
    ...value,
    content: value.content ?? '',
    result_content: value.result_content ?? null,
    author_photo_url: value.author_photo_url ?? null,
    closed_at: date(value.closed_at),
    created_at: date(value.created_at),
    started_at: date(value.started_at),
    updated_at: date(value.updated_at),
  };
}

function normalizeSummary(value: RawFacility): FacilitySummary {
  const facility = normalizeFacility(value);
  const { content: _content, result_content: _result, started_at: _started, closed_at: _closed, ...summary } = facility;
  return summary;
}

export async function listFacilities(input: {
  bucket: 'active' | 'closed'; query?: string; sort?: FacilitySortOption; status?: FacilityStatus | ''; cursor?: FacilityCursor | null;
}): Promise<FacilityPageResult> {
  try {
    const fn = invokeBackendAction<typeof input & { pageSize: number }, { facilities: RawFacility[]; cursor: FacilityCursor | null; hasMore: boolean }>('listFacilities');
    const result = await fn({ ...input, pageSize: 20 });
    return { ...result, facilities: result.facilities.map(normalizeSummary) };
  } catch (error) { throw toReadableBackendError(error); }
}

export async function getFacility(facilityId: string) {
  try {
    const fn = invokeBackendAction<{ facilityId: string }, { facility: RawFacility }>('getFacility');
    return normalizeFacility((await fn({ facilityId })).facility);
  } catch (error) { throw toReadableBackendError(error); }
}

export async function createFacility(input: FacilityInput) {
  try {
    const fn = invokeBackendAction<FacilityInput & { requestId: string }, { facility: RawFacility }>('createFacility');
    return normalizeFacility((await fn({ ...input, requestId: createRequestId() })).facility);
  } catch (error) { throw toReadableBackendError(error); }
}

export async function toggleFacilityAffected(facilityId: string) {
  try {
    const fn = invokeBackendAction<{ facilityId: string; requestId: string }, { affected: boolean; affected_count: number }>('toggleFacilityAffected');
    return await fn({ facilityId, requestId: createRequestId() });
  } catch (error) { throw toReadableBackendError(error); }
}

export async function updateFacilityStatus(facilityId: string, status: FacilityStatus, resultContent?: string) {
  try {
    const fn = invokeBackendAction<{ facilityId: string; status: FacilityStatus; resultContent?: string; requestId: string }, { facility: RawFacility }>('updateFacilityStatus');
    return normalizeFacility((await fn({ facilityId, status, resultContent, requestId: createRequestId() })).facility);
  } catch (error) { throw toReadableBackendError(error); }
}

export async function deleteFacility(facilityId: string) {
  try {
    const fn = invokeBackendAction<{ facilityId: string; requestId: string }, { success: boolean }>('deleteFacility');
    return await fn({ facilityId, requestId: createRequestId() });
  } catch (error) { throw toReadableBackendError(error); }
}
