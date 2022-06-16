const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ScopeSchema = new Schema({
  id: Number,
  name: String,
  uriPattern: String,
  createdBy: String,
  updatedBy: String,
  forwardData: {
    uri: String,
    service: String,
    forwardType: String,
  },
  forwardType: String,
  createdAt: Date,
  updatedAt: Date,
  groupIds: [Number],
  isPublic: Boolean,
});

const ScopeModel = mongoose.model('c_scopes', ScopeSchema);

module.exports = {
  ScopeModel,
};
