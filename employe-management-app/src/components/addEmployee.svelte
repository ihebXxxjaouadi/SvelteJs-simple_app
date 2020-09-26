<script>
	
	import { createEventDispatcher } from "svelte";

	const Dispatch = createEventDispatcher();

	let employee = {
		name: '',
		age: '',
		job: '',
		salary: 0,
		experience: 0
	};

	let addemployee = () => {
		console.log('hello')
		Dispatch('addemployee', employee)
	} 

</script>

<form class="col-6 col-md-3 mx-auto m-4 card border-primary px-4 " on:submit|preventDefault={addemployee}>
	<div class="row">
		<input type="text" class="form-control m-1 form-control-sm col-7 " placeholder="name" bind:value={employee.name}>
		<input type="text" class="form-control m-1 form-control-sm col-4" placeholder="age" bind:value={employee.age}>	
	
		<input type="text" class="form-control m-1 form-control-sm col-4" placeholder="job" bind:value={employee.job}> 
		<input type="text" class="form-control my-1 form-control-sm col-3" placeholder="salary" bind:value={employee.salary}>
		<input type="number" min="0" max="10" class="form-control m-1 form-control-sm col-4" placeholder="experience" bind:value={employee.experience}>
		<button class="btn btn-primary m-2 mx-auto col-9 col-md-6 "> Add employee </button>
	</div>
</form>
