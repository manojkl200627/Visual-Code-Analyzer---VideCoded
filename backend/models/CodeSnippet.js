import mongoose from 'mongoose';

const variableSchema = new mongoose.Schema({
  id: String, // e.g. "s", "t", "lenS", "lenT"
  label: String, // e.g. "STRING S"
  type: String, // "array", "variable"
  value: mongoose.Schema.Types.Mixed, // Can be array of chars, string, or number
  highlights: [Number] // Indices to highlight if type is array
});

const stepSchema = new mongoose.Schema({
  stepIndex: Number,
  explanation: String,
  activeLine: Number,
  variables: [variableSchema]
});

const codeSnippetSchema = new mongoose.Schema({
  title: String,
  language: String,
  code: String,
  steps: [stepSchema],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('CodeSnippet', codeSnippetSchema);
