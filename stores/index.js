import AccountStore from './accountStore';
import DelegateStore from './delegateStore';

const Dispatcher = require('flux').Dispatcher;
const Emitter = require('events').EventEmitter;

const dispatcher = new Dispatcher();
const emitter = new Emitter();

const accountStore = new AccountStore(dispatcher, emitter);
const delegateStore = new DelegateStore(dispatcher, emitter);

export default {
  accountStore: accountStore,
  delegateStore: delegateStore,
  dispatcher: dispatcher,
  emitter: emitter,
};
