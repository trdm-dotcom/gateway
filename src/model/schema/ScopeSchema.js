const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ScopeSchema = new Schema({
    id: Number,
    name: String,
    uriPattern: String,
    forwardData: {
      uri: String,
      service: String,
      forwardType: String,
    },
    forwardType: String,
    groupIds: [Number],
    isPublic: Boolean,
  },
  {
    timestamps: {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  }
});

const ScopeModel = mongoose.model('c_scope', ScopeSchema);

module.exports = {
  ScopeModel,
};
