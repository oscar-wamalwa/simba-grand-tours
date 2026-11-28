import { useState } from 'react';

const parseLines = (text) => text.split('\n').map(item => item.trim()).filter(Boolean);

// Keeps the raw text while typing so spaces and new lines are not stripped; the cleaned list goes to the form.
export default function LineListField({ value, onChange, ...textareaProps }) {
  const [text, setText] = useState(value);
  return (
    <textarea
      {...textareaProps}
      value={text}
      onChange={event => {
        setText(event.target.value);
        onChange(parseLines(event.target.value));
      }}
    />
  );
}
