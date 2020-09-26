
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? undefined : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    const active_docs = new Set();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = node.ownerDocument;
        active_docs.add(doc);
        const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = doc.head.appendChild(element('style')).sheet);
        const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
        if (!current_rules[name]) {
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ``}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            active_docs.forEach(doc => {
                const stylesheet = doc.__svelte_stylesheet;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                doc.__svelte_rules = {};
            });
            active_docs.clear();
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_bidirectional_transition(node, fn, params, intro) {
        let config = fn(node, params);
        let t = intro ? 0 : 1;
        let running_program = null;
        let pending_program = null;
        let animation_name = null;
        function clear_animation() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function init(program, duration) {
            const d = program.b - t;
            duration *= Math.abs(d);
            return {
                a: t,
                b: program.b,
                d,
                duration,
                start: program.start,
                end: program.start + duration,
                group: program.group
            };
        }
        function go(b) {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            const program = {
                start: now() + delay,
                b
            };
            if (!b) {
                // @ts-ignore todo: improve typings
                program.group = outros;
                outros.r += 1;
            }
            if (running_program) {
                pending_program = program;
            }
            else {
                // if this is an intro, and there's a delay, we need to do
                // an initial tick and/or apply CSS animation immediately
                if (css) {
                    clear_animation();
                    animation_name = create_rule(node, t, b, duration, delay, easing, css);
                }
                if (b)
                    tick(0, 1);
                running_program = init(program, duration);
                add_render_callback(() => dispatch(node, b, 'start'));
                loop(now => {
                    if (pending_program && now > pending_program.start) {
                        running_program = init(pending_program, duration);
                        pending_program = null;
                        dispatch(node, running_program.b, 'start');
                        if (css) {
                            clear_animation();
                            animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                        }
                    }
                    if (running_program) {
                        if (now >= running_program.end) {
                            tick(t = running_program.b, 1 - t);
                            dispatch(node, running_program.b, 'end');
                            if (!pending_program) {
                                // we're done
                                if (running_program.b) {
                                    // intro — we can tidy up immediately
                                    clear_animation();
                                }
                                else {
                                    // outro — needs to be coordinated
                                    if (!--running_program.group.r)
                                        run_all(running_program.group.c);
                                }
                            }
                            running_program = null;
                        }
                        else if (now >= running_program.start) {
                            const p = now - running_program.start;
                            t = running_program.a + running_program.d * easing(p / running_program.duration);
                            tick(t, 1 - t);
                        }
                    }
                    return !!(running_program || pending_program);
                });
            }
        }
        return {
            run(b) {
                if (is_function(config)) {
                    wait().then(() => {
                        // @ts-ignore
                        config = config();
                        go(b);
                    });
                }
                else {
                    go(b);
                }
            },
            end() {
                clear_animation();
                running_program = pending_program = null;
            }
        };
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.24.1' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    function fade(node, { delay = 0, duration = 400, easing = identity }) {
        const o = +getComputedStyle(node).opacity;
        return {
            delay,
            duration,
            easing,
            css: t => `opacity: ${t * o}`
        };
    }

    /* src\components\Header.svelte generated by Svelte v3.24.1 */

    const file = "src\\components\\Header.svelte";

    function create_fragment(ctx) {
    	let nav;
    	let h3;

    	const block = {
    		c: function create() {
    			nav = element("nav");
    			h3 = element("h3");
    			h3.textContent = "Employe management";
    			attr_dev(h3, "class", "mx-auto mh-3 text-info");
    			add_location(h3, file, 1, 1, 32);
    			attr_dev(nav, "class", "navbar bg-light");
    			add_location(nav, file, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, nav, anchor);
    			append_dev(nav, h3);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(nav);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Header> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Header", $$slots, []);
    	return [];
    }

    class Header extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Header",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    /* src\components\infoContainer.svelte generated by Svelte v3.24.1 */
    const file$1 = "src\\components\\infoContainer.svelte";

    // (36:3) {#if showEmployeInfo }
    function create_if_block(ctx) {
    	let div;
    	let span15;
    	let t0;
    	let span14;
    	let span13;
    	let t1;
    	let span12;
    	let span11;
    	let t2;
    	let span10;
    	let span9;
    	let t3;
    	let span8;
    	let span7;
    	let t4;
    	let span6;
    	let span5;
    	let t5;
    	let t6;
    	let span4;
    	let span3;
    	let t7;
    	let span2;
    	let span1;
    	let t8;
    	let t9;
    	let span0;
    	let button0;
    	let t11;
    	let button1;
    	let t13;
    	let p;
    	let div_transition;
    	let current;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			span15 = element("span");
    			t0 = text("age: ");
    			span14 = element("span");
    			span13 = element("span");
    			t1 = text(/*age*/ ctx[2]);
    			span12 = element("span");
    			span11 = element("span");
    			t2 = text("job: ");
    			span10 = element("span");
    			span9 = element("span");
    			t3 = text(/*job*/ ctx[3]);
    			span8 = element("span");
    			span7 = element("span");
    			t4 = text("experience: ");
    			span6 = element("span");
    			span5 = element("span");
    			t5 = text(/*experience*/ ctx[4]);
    			t6 = text(" years");
    			span4 = element("span");
    			span3 = element("span");
    			t7 = text("salary: ");
    			span2 = element("span");
    			span1 = element("span");
    			t8 = text(/*salary*/ ctx[0]);
    			t9 = space();
    			span0 = element("span");
    			button0 = element("button");
    			button0.textContent = "+";
    			t11 = space();
    			button1 = element("button");
    			button1.textContent = "-";
    			t13 = space();
    			p = element("p");
    			p.textContent = "© app made it by iheb";
    			attr_dev(button0, "class", "btn btn-secondary btn-sm ml-1 rounded-0");
    			add_location(button0, file$1, 41, 5, 1413);
    			attr_dev(button1, "class", "btn btn-light btn-sm rounded-0");
    			add_location(button1, file$1, 42, 5, 1510);
    			attr_dev(p, "class", "text-danger text-right pt-4 m-0");
    			add_location(p, file$1, 43, 5, 1599);
    			add_location(span0, file$1, 40, 97, 1400);
    			attr_dev(span1, "class", "text-muted d-inline");
    			add_location(span1, file$1, 40, 54, 1357);
    			add_location(span2, file$1, 40, 48, 1351);
    			attr_dev(span3, "class", "text-primary d-block");
    			add_location(span3, file$1, 40, 5, 1308);
    			add_location(span4, file$1, 39, 112, 1295);
    			attr_dev(span5, "class", "text-muted d-inline");
    			add_location(span5, file$1, 39, 58, 1241);
    			add_location(span6, file$1, 39, 52, 1235);
    			attr_dev(span7, "class", "text-primary d-block");
    			add_location(span7, file$1, 39, 5, 1188);
    			add_location(span8, file$1, 38, 83, 1175);
    			attr_dev(span9, "class", "text-muted");
    			add_location(span9, file$1, 38, 51, 1143);
    			add_location(span10, file$1, 38, 45, 1137);
    			attr_dev(span11, "class", "text-primary d-block");
    			add_location(span11, file$1, 38, 5, 1097);
    			add_location(span12, file$1, 37, 103, 1084);
    			attr_dev(span13, "class", "text-muted");
    			add_location(span13, file$1, 37, 70, 1051);
    			add_location(span14, file$1, 37, 64, 1045);
    			attr_dev(span15, "class", "titleInfo text-primary font-weight-bold svelte-16p754s");
    			add_location(span15, file$1, 37, 5, 986);
    			attr_dev(div, "class", "card-block m-2");
    			add_location(div, file$1, 36, 4, 933);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, span15);
    			append_dev(span15, t0);
    			append_dev(span15, span14);
    			append_dev(span14, span13);
    			append_dev(span13, t1);
    			append_dev(span13, span12);
    			append_dev(span12, span11);
    			append_dev(span11, t2);
    			append_dev(span11, span10);
    			append_dev(span10, span9);
    			append_dev(span9, t3);
    			append_dev(span9, span8);
    			append_dev(span8, span7);
    			append_dev(span7, t4);
    			append_dev(span7, span6);
    			append_dev(span6, span5);
    			append_dev(span5, t5);
    			append_dev(span5, t6);
    			append_dev(span5, span4);
    			append_dev(span4, span3);
    			append_dev(span3, t7);
    			append_dev(span3, span2);
    			append_dev(span2, span1);
    			append_dev(span1, t8);
    			append_dev(span1, t9);
    			append_dev(span1, span0);
    			append_dev(span0, button0);
    			append_dev(span0, t11);
    			append_dev(span0, button1);
    			append_dev(span0, t13);
    			append_dev(span0, p);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*addToSalary*/ ctx[7], false, false, false),
    					listen_dev(button1, "click", /*reduceSalary*/ ctx[8], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (!current || dirty & /*age*/ 4) set_data_dev(t1, /*age*/ ctx[2]);
    			if (!current || dirty & /*job*/ 8) set_data_dev(t3, /*job*/ ctx[3]);
    			if (!current || dirty & /*experience*/ 16) set_data_dev(t5, /*experience*/ ctx[4]);
    			if (!current || dirty & /*salary*/ 1) set_data_dev(t8, /*salary*/ ctx[0]);
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!div_transition) div_transition = create_bidirectional_transition(div, fade, {}, true);
    				div_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!div_transition) div_transition = create_bidirectional_transition(div, fade, {}, false);
    			div_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching && div_transition) div_transition.end();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(36:3) {#if showEmployeInfo }",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let main;
    	let div1;
    	let div0;
    	let h5;
    	let t0;
    	let t1;
    	let button0;
    	let t2_value = (/*showEmployeInfo*/ ctx[5] ? "-" : "+") + "";
    	let t2;
    	let t3;
    	let button1;
    	let t5;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block = /*showEmployeInfo*/ ctx[5] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			div1 = element("div");
    			div0 = element("div");
    			h5 = element("h5");
    			t0 = text(/*name*/ ctx[1]);
    			t1 = space();
    			button0 = element("button");
    			t2 = text(t2_value);
    			t3 = space();
    			button1 = element("button");
    			button1.textContent = "x";
    			t5 = space();
    			if (if_block) if_block.c();
    			attr_dev(h5, "class", "text-success font-weight-bold d-inline");
    			add_location(h5, file$1, 32, 3, 651);
    			attr_dev(button0, "class", "btn btn-success");
    			add_location(button0, file$1, 33, 3, 722);
    			attr_dev(button1, "class", "btn btn-danger ");
    			add_location(button1, file$1, 34, 3, 832);
    			attr_dev(div0, "class", "blockContainer card-block px-2 pt_-2");
    			add_location(div0, file$1, 31, 2, 596);
    			attr_dev(div1, "class", "col-6 col-md-3 mx-auto m-4 card border");
    			add_location(div1, file$1, 30, 1, 540);
    			add_location(main, file$1, 29, 0, 531);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div1);
    			append_dev(div1, div0);
    			append_dev(div0, h5);
    			append_dev(h5, t0);
    			append_dev(div0, t1);
    			append_dev(div0, button0);
    			append_dev(button0, t2);
    			append_dev(div0, t3);
    			append_dev(div0, button1);
    			append_dev(div0, t5);
    			if (if_block) if_block.m(div0, null);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*toggleShowEmployeInfo*/ ctx[6], false, false, false),
    					listen_dev(button1, "click", /*removeEmployee*/ ctx[9], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*name*/ 2) set_data_dev(t0, /*name*/ ctx[1]);
    			if ((!current || dirty & /*showEmployeInfo*/ 32) && t2_value !== (t2_value = (/*showEmployeInfo*/ ctx[5] ? "-" : "+") + "")) set_data_dev(t2, t2_value);

    			if (/*showEmployeInfo*/ ctx[5]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*showEmployeInfo*/ 32) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(div0, null);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if (if_block) if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	const Dispatch = createEventDispatcher();

    	let { name } = $$props,
    		{ age } = $$props,
    		{ country } = $$props,
    		{ job } = $$props,
    		{ skills } = $$props,
    		{ experience } = $$props,
    		{ salary } = $$props;

    	let showEmployeInfo = true;

    	let toggleShowEmployeInfo = () => {
    		$$invalidate(5, showEmployeInfo = !showEmployeInfo);
    	};

    	let addToSalary = () => {
    		$$invalidate(0, salary += 100);
    	};

    	let reduceSalary = () => {
    		$$invalidate(0, salary -= 100);
    	};

    	let removeEmployee = () => {
    		Dispatch("removeemploye", name);
    	};

    	const writable_props = ["name", "age", "country", "job", "skills", "experience", "salary"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<InfoContainer> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("InfoContainer", $$slots, []);

    	$$self.$$set = $$props => {
    		if ("name" in $$props) $$invalidate(1, name = $$props.name);
    		if ("age" in $$props) $$invalidate(2, age = $$props.age);
    		if ("country" in $$props) $$invalidate(10, country = $$props.country);
    		if ("job" in $$props) $$invalidate(3, job = $$props.job);
    		if ("skills" in $$props) $$invalidate(11, skills = $$props.skills);
    		if ("experience" in $$props) $$invalidate(4, experience = $$props.experience);
    		if ("salary" in $$props) $$invalidate(0, salary = $$props.salary);
    	};

    	$$self.$capture_state = () => ({
    		fade,
    		createEventDispatcher,
    		Dispatch,
    		name,
    		age,
    		country,
    		job,
    		skills,
    		experience,
    		salary,
    		showEmployeInfo,
    		toggleShowEmployeInfo,
    		addToSalary,
    		reduceSalary,
    		removeEmployee
    	});

    	$$self.$inject_state = $$props => {
    		if ("name" in $$props) $$invalidate(1, name = $$props.name);
    		if ("age" in $$props) $$invalidate(2, age = $$props.age);
    		if ("country" in $$props) $$invalidate(10, country = $$props.country);
    		if ("job" in $$props) $$invalidate(3, job = $$props.job);
    		if ("skills" in $$props) $$invalidate(11, skills = $$props.skills);
    		if ("experience" in $$props) $$invalidate(4, experience = $$props.experience);
    		if ("salary" in $$props) $$invalidate(0, salary = $$props.salary);
    		if ("showEmployeInfo" in $$props) $$invalidate(5, showEmployeInfo = $$props.showEmployeInfo);
    		if ("toggleShowEmployeInfo" in $$props) $$invalidate(6, toggleShowEmployeInfo = $$props.toggleShowEmployeInfo);
    		if ("addToSalary" in $$props) $$invalidate(7, addToSalary = $$props.addToSalary);
    		if ("reduceSalary" in $$props) $$invalidate(8, reduceSalary = $$props.reduceSalary);
    		if ("removeEmployee" in $$props) $$invalidate(9, removeEmployee = $$props.removeEmployee);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		salary,
    		name,
    		age,
    		job,
    		experience,
    		showEmployeInfo,
    		toggleShowEmployeInfo,
    		addToSalary,
    		reduceSalary,
    		removeEmployee,
    		country,
    		skills
    	];
    }

    class InfoContainer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {
    			name: 1,
    			age: 2,
    			country: 10,
    			job: 3,
    			skills: 11,
    			experience: 4,
    			salary: 0
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "InfoContainer",
    			options,
    			id: create_fragment$1.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*name*/ ctx[1] === undefined && !("name" in props)) {
    			console.warn("<InfoContainer> was created without expected prop 'name'");
    		}

    		if (/*age*/ ctx[2] === undefined && !("age" in props)) {
    			console.warn("<InfoContainer> was created without expected prop 'age'");
    		}

    		if (/*country*/ ctx[10] === undefined && !("country" in props)) {
    			console.warn("<InfoContainer> was created without expected prop 'country'");
    		}

    		if (/*job*/ ctx[3] === undefined && !("job" in props)) {
    			console.warn("<InfoContainer> was created without expected prop 'job'");
    		}

    		if (/*skills*/ ctx[11] === undefined && !("skills" in props)) {
    			console.warn("<InfoContainer> was created without expected prop 'skills'");
    		}

    		if (/*experience*/ ctx[4] === undefined && !("experience" in props)) {
    			console.warn("<InfoContainer> was created without expected prop 'experience'");
    		}

    		if (/*salary*/ ctx[0] === undefined && !("salary" in props)) {
    			console.warn("<InfoContainer> was created without expected prop 'salary'");
    		}
    	}

    	get name() {
    		throw new Error("<InfoContainer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<InfoContainer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get age() {
    		throw new Error("<InfoContainer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set age(value) {
    		throw new Error("<InfoContainer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get country() {
    		throw new Error("<InfoContainer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set country(value) {
    		throw new Error("<InfoContainer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get job() {
    		throw new Error("<InfoContainer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set job(value) {
    		throw new Error("<InfoContainer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get skills() {
    		throw new Error("<InfoContainer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set skills(value) {
    		throw new Error("<InfoContainer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get experience() {
    		throw new Error("<InfoContainer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set experience(value) {
    		throw new Error("<InfoContainer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get salary() {
    		throw new Error("<InfoContainer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set salary(value) {
    		throw new Error("<InfoContainer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\AddEmployee.svelte generated by Svelte v3.24.1 */

    const { console: console_1 } = globals;
    const file$2 = "src\\components\\AddEmployee.svelte";

    function create_fragment$2(ctx) {
    	let form;
    	let div;
    	let input0;
    	let t0;
    	let input1;
    	let t1;
    	let input2;
    	let t2;
    	let input3;
    	let t3;
    	let input4;
    	let t4;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			form = element("form");
    			div = element("div");
    			input0 = element("input");
    			t0 = space();
    			input1 = element("input");
    			t1 = space();
    			input2 = element("input");
    			t2 = space();
    			input3 = element("input");
    			t3 = space();
    			input4 = element("input");
    			t4 = space();
    			button = element("button");
    			button.textContent = "Add employee";
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "class", "form-control m-1 form-control-sm col-7 ");
    			attr_dev(input0, "placeholder", "name");
    			add_location(input0, file$2, 23, 2, 444);
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "class", "form-control m-1 form-control-sm col-4");
    			attr_dev(input1, "placeholder", "age");
    			add_location(input1, file$2, 24, 2, 561);
    			attr_dev(input2, "type", "text");
    			attr_dev(input2, "class", "form-control m-1 form-control-sm col-4");
    			attr_dev(input2, "placeholder", "job");
    			add_location(input2, file$2, 26, 2, 679);
    			attr_dev(input3, "type", "text");
    			attr_dev(input3, "class", "form-control my-1 form-control-sm col-3");
    			attr_dev(input3, "placeholder", "salary");
    			add_location(input3, file$2, 27, 2, 794);
    			attr_dev(input4, "type", "number");
    			attr_dev(input4, "min", "0");
    			attr_dev(input4, "max", "10");
    			attr_dev(input4, "class", "form-control m-1 form-control-sm col-4");
    			attr_dev(input4, "placeholder", "experience");
    			add_location(input4, file$2, 28, 2, 915);
    			attr_dev(button, "class", "btn btn-primary m-2 mx-auto col-9 col-md-6 ");
    			add_location(button, file$2, 29, 2, 1062);
    			attr_dev(div, "class", "row");
    			add_location(div, file$2, 22, 1, 423);
    			attr_dev(form, "class", "col-6 col-md-3 mx-auto m-4 card border-primary px-4 ");
    			add_location(form, file$2, 21, 0, 314);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, form, anchor);
    			append_dev(form, div);
    			append_dev(div, input0);
    			set_input_value(input0, /*employee*/ ctx[0].name);
    			append_dev(div, t0);
    			append_dev(div, input1);
    			set_input_value(input1, /*employee*/ ctx[0].age);
    			append_dev(div, t1);
    			append_dev(div, input2);
    			set_input_value(input2, /*employee*/ ctx[0].job);
    			append_dev(div, t2);
    			append_dev(div, input3);
    			set_input_value(input3, /*employee*/ ctx[0].salary);
    			append_dev(div, t3);
    			append_dev(div, input4);
    			set_input_value(input4, /*employee*/ ctx[0].experience);
    			append_dev(div, t4);
    			append_dev(div, button);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[2]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[3]),
    					listen_dev(input2, "input", /*input2_input_handler*/ ctx[4]),
    					listen_dev(input3, "input", /*input3_input_handler*/ ctx[5]),
    					listen_dev(input4, "input", /*input4_input_handler*/ ctx[6]),
    					listen_dev(form, "submit", prevent_default(/*addemployee*/ ctx[1]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*employee*/ 1 && input0.value !== /*employee*/ ctx[0].name) {
    				set_input_value(input0, /*employee*/ ctx[0].name);
    			}

    			if (dirty & /*employee*/ 1 && input1.value !== /*employee*/ ctx[0].age) {
    				set_input_value(input1, /*employee*/ ctx[0].age);
    			}

    			if (dirty & /*employee*/ 1 && input2.value !== /*employee*/ ctx[0].job) {
    				set_input_value(input2, /*employee*/ ctx[0].job);
    			}

    			if (dirty & /*employee*/ 1 && input3.value !== /*employee*/ ctx[0].salary) {
    				set_input_value(input3, /*employee*/ ctx[0].salary);
    			}

    			if (dirty & /*employee*/ 1 && to_number(input4.value) !== /*employee*/ ctx[0].experience) {
    				set_input_value(input4, /*employee*/ ctx[0].experience);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(form);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	const Dispatch = createEventDispatcher();

    	let employee = {
    		name: "",
    		age: "",
    		job: "",
    		salary: 0,
    		experience: 0
    	};

    	let addemployee = () => {
    		console.log("hello");
    		Dispatch("addemployee", employee);
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<AddEmployee> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("AddEmployee", $$slots, []);

    	function input0_input_handler() {
    		employee.name = this.value;
    		$$invalidate(0, employee);
    	}

    	function input1_input_handler() {
    		employee.age = this.value;
    		$$invalidate(0, employee);
    	}

    	function input2_input_handler() {
    		employee.job = this.value;
    		$$invalidate(0, employee);
    	}

    	function input3_input_handler() {
    		employee.salary = this.value;
    		$$invalidate(0, employee);
    	}

    	function input4_input_handler() {
    		employee.experience = to_number(this.value);
    		$$invalidate(0, employee);
    	}

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		Dispatch,
    		employee,
    		addemployee
    	});

    	$$self.$inject_state = $$props => {
    		if ("employee" in $$props) $$invalidate(0, employee = $$props.employee);
    		if ("addemployee" in $$props) $$invalidate(1, addemployee = $$props.addemployee);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		employee,
    		addemployee,
    		input0_input_handler,
    		input1_input_handler,
    		input2_input_handler,
    		input3_input_handler,
    		input4_input_handler
    	];
    }

    class AddEmployee extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "AddEmployee",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src\App.svelte generated by Svelte v3.24.1 */

    const { console: console_1$1 } = globals;
    const file$3 = "src\\App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[3] = list[i];
    	return child_ctx;
    }

    // (46:1) {:else }
    function create_else_block(ctx) {
    	let div;
    	let p;
    	let t1;
    	let div_transition;
    	let current;

    	const block = {
    		c: function create() {
    			div = element("div");
    			p = element("p");
    			p.textContent = "no employes";
    			t1 = space();
    			attr_dev(p, "class", "text-info");
    			add_location(p, file$3, 48, 3, 1225);
    			attr_dev(div, "class", "text-center");
    			add_location(div, file$3, 47, 2, 1162);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, p);
    			append_dev(div, t1);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!div_transition) div_transition = create_bidirectional_transition(div, fade, { duration: 3000 }, true);
    				div_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!div_transition) div_transition = create_bidirectional_transition(div, fade, { duration: 3000 }, false);
    			div_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching && div_transition) div_transition.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(46:1) {:else }",
    		ctx
    	});

    	return block;
    }

    // (35:1) {#each employes as employe}
    function create_each_block(ctx) {
    	let infocontainer;
    	let current;

    	infocontainer = new InfoContainer({
    			props: {
    				name: /*employe*/ ctx[3].name,
    				age: /*employe*/ ctx[3].age,
    				country: /*employe*/ ctx[3].country,
    				job: /*employe*/ ctx[3].job,
    				skills: /*employe*/ ctx[3].skills,
    				experience: "" + (/*employe*/ ctx[3].experience + ","),
    				salary: /*employe*/ ctx[3].salary
    			},
    			$$inline: true
    		});

    	infocontainer.$on("removeemploye", /*removeEmployee*/ ctx[1]);

    	const block = {
    		c: function create() {
    			create_component(infocontainer.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(infocontainer, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const infocontainer_changes = {};
    			if (dirty & /*employes*/ 1) infocontainer_changes.name = /*employe*/ ctx[3].name;
    			if (dirty & /*employes*/ 1) infocontainer_changes.age = /*employe*/ ctx[3].age;
    			if (dirty & /*employes*/ 1) infocontainer_changes.country = /*employe*/ ctx[3].country;
    			if (dirty & /*employes*/ 1) infocontainer_changes.job = /*employe*/ ctx[3].job;
    			if (dirty & /*employes*/ 1) infocontainer_changes.skills = /*employe*/ ctx[3].skills;
    			if (dirty & /*employes*/ 1) infocontainer_changes.experience = "" + (/*employe*/ ctx[3].experience + ",");
    			if (dirty & /*employes*/ 1) infocontainer_changes.salary = /*employe*/ ctx[3].salary;
    			infocontainer.$set(infocontainer_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(infocontainer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(infocontainer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(infocontainer, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(35:1) {#each employes as employe}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let main;
    	let header;
    	let t0;
    	let addemployee;
    	let t1;
    	let current;
    	header = new Header({ $$inline: true });
    	addemployee = new AddEmployee({ $$inline: true });
    	addemployee.$on("addemployee", /*addEmployee*/ ctx[2]);
    	let each_value = /*employes*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	let each_1_else = null;

    	if (!each_value.length) {
    		each_1_else = create_else_block(ctx);
    	}

    	const block = {
    		c: function create() {
    			main = element("main");
    			create_component(header.$$.fragment);
    			t0 = space();
    			create_component(addemployee.$$.fragment);
    			t1 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			if (each_1_else) {
    				each_1_else.c();
    			}

    			add_location(main, file$3, 30, 0, 803);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			mount_component(header, main, null);
    			append_dev(main, t0);
    			mount_component(addemployee, main, null);
    			append_dev(main, t1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(main, null);
    			}

    			if (each_1_else) {
    				each_1_else.m(main, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*employes, removeEmployee*/ 3) {
    				each_value = /*employes*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(main, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();

    				if (!each_value.length && each_1_else) {
    					each_1_else.p(ctx, dirty);
    				} else if (!each_value.length) {
    					each_1_else = create_else_block(ctx);
    					each_1_else.c();
    					transition_in(each_1_else, 1);
    					each_1_else.m(main, null);
    				} else if (each_1_else) {
    					group_outros();

    					transition_out(each_1_else, 1, 1, () => {
    						each_1_else = null;
    					});

    					check_outros();
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(header.$$.fragment, local);
    			transition_in(addemployee.$$.fragment, local);

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(header.$$.fragment, local);
    			transition_out(addemployee.$$.fragment, local);
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(header);
    			destroy_component(addemployee);
    			destroy_each(each_blocks, detaching);
    			if (each_1_else) each_1_else.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let employes = [
    		{
    			name: "Jhon carl",
    			age: "21",
    			job: "web devolpper",
    			experience: "2",
    			salary: 1200
    		},
    		{
    			name: "David",
    			age: "25",
    			job: "web devolpper",
    			experience: "3",
    			salary: 1500
    		},
    		{
    			name: "Rami khaled",
    			age: "24",
    			job: "software engenniring",
    			experience: "5",
    			salary: 3000
    		}
    	];

    	let removeEmployee = e => {
    		const employeeName = e.detail;
    		$$invalidate(0, employes = employes.filter(employee => employee.name !== employeeName));
    	};

    	let addEmployee = e => {
    		const newEmployee = e.detail;
    		$$invalidate(0, employes = [...employes, newEmployee]);
    		console.log(employes);
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1$1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("App", $$slots, []);

    	$$self.$capture_state = () => ({
    		fade,
    		Header,
    		InfoContainer,
    		AddEmployee,
    		employes,
    		removeEmployee,
    		addEmployee
    	});

    	$$self.$inject_state = $$props => {
    		if ("employes" in $$props) $$invalidate(0, employes = $$props.employes);
    		if ("removeEmployee" in $$props) $$invalidate(1, removeEmployee = $$props.removeEmployee);
    		if ("addEmployee" in $$props) $$invalidate(2, addEmployee = $$props.addEmployee);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [employes, removeEmployee, addEmployee];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
