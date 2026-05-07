import { createSlice } from '@reduxjs/toolkit';

const slice = createSlice({
  name: 'theme',
  initialState: {
    activePortal: 'devportal',
    isDirty: false,
  },
  reducers: {
    setPortal: (s, a) => { s.activePortal = a.payload; s.isDirty = false; },
    markDirty: (s) => { s.isDirty = true; },
    markClean: (s) => { s.isDirty = false; },
  },
});

export const { setPortal, markDirty, markClean } = slice.actions;
export default slice.reducer;
