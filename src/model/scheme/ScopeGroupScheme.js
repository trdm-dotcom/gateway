const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ScopeGroupSchema = new Schema({
  id: Number,
  scopeGroupName: String,
  createdBy: String,
  updatedBy: String,
  createdAt: Date,
  updatedAt: Date,
  scopeIds: [Number],
});

const ScopeGroupModel = mongoose.model('c_scope_groups', ScopeGroupSchema);

module.exports = {
  ScopeGroupModel,
};
