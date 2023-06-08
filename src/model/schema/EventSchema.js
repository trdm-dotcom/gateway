const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const EventSchema = new Schema(
  {
    id: Number,
    eventName: String,
    eventClient: String,
    scopeId: Number,
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

const EventModel = mongoose.model('c_event', EventSchema);

module.exports = {
  EventModel,
};
