const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ScopeGroupSchema = new Schema(
  {
    id: Number,
    scopeGroupName: String,
    createdBy: String,
    updatedBy: String,
    scopeIds: [Number],
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

const ScopeGroupModel = mongoose.model("c_scope_group", ScopeGroupSchema);

module.exports = {
  ScopeGroupModel,
};
