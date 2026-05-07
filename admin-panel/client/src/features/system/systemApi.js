import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const systemApi = createApi({
  reducerPath: 'systemApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api', credentials: 'same-origin' }),
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
