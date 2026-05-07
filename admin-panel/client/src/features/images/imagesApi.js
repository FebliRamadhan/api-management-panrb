import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const imagesApi = createApi({
  reducerPath: 'imagesApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api', credentials: 'same-origin' }),
  tagTypes: ['Images'],
  endpoints: (b) => ({
    listImages: b.query({
      query: (portal) => `/images/${portal}`,
      providesTags: (_r, _e, p) => [{ type: 'Images', id: p }],
    }),
    uploadImage: b.mutation({
      query: ({ portal, file }) => {
        const fd = new FormData();
        fd.append('image', file);
        fd.append('portal', portal);
        return { url: '/images/upload', method: 'POST', body: fd };
      },
      invalidatesTags: (_r, _e, { portal }) => [{ type: 'Images', id: portal }],
    }),
    deleteImage: b.mutation({
      query: ({ portal, filename }) => ({
        url: `/images/${portal}/${encodeURIComponent(filename)}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_r, _e, { portal }) => [{ type: 'Images', id: portal }],
    }),
  }),
});

export const {
  useListImagesQuery,
  useUploadImageMutation,
  useDeleteImageMutation,
} = imagesApi;
