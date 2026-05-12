import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE } from '../../lib/apiBase';

export const systemApi = createApi({
  reducerPath: 'systemApi',
  baseQuery: fetchBaseQuery({ baseUrl: API_BASE, credentials: 'same-origin' }),
  tagTypes: ['Status'],
  endpoints: (b) => ({
    status: b.query({
      query: () => '/status',
      providesTags: ['Status'],
    }),
    restart: b.mutation({
      query: () => ({ url: '/restart', method: 'POST' }),
      invalidatesTags: ['Status'],
    }),
  }),
});

export const { useStatusQuery, useRestartMutation } = systemApi;
