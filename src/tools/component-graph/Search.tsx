'use client';

import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import { LuSearch } from 'react-icons/lu';

export function GraphSearch({
  value,
  onChange,
  placeholder = 'Search components…',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <TextField
      size="small"
      fullWidth
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <LuSearch size={15} />
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
