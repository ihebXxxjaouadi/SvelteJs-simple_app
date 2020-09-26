<script>
	import { fade } from "svelte/transition";
	import { createEventDispatcher } from "svelte";

	const Dispatch = createEventDispatcher();
	
	export let name, age, country, job, skills, experience, salary;

	let showEmployeInfo = true ;
	let toggleShowEmployeInfo = () => {
		showEmployeInfo = !showEmployeInfo ;
	}

	let addToSalary = () => {
		salary += 100;
	}

	let reduceSalary = () => {
		salary -= 100;
	}

	let removeEmployee = () => {
		Dispatch('removeemploye', name)
	}
	


</script>

<main>
	<div class='col-6 col-md-3 mx-auto m-4 card border'>
		<div class="blockContainer card-block px-2 pt_-2">
			<h5 class="text-success font-weight-bold d-inline"> { name } </h5>
			<button class="btn btn-success" on:click={toggleShowEmployeInfo}>{ showEmployeInfo ? '-' : '+' }</button>
			<button class="btn btn-danger " on:click={removeEmployee}>x</button>
			{#if showEmployeInfo }
				<div class="card-block m-2" transition:fade|> 
					<span class="titleInfo text-primary font-weight-bold">age: <span><span class="text-muted"> { age }<span>
					<span class="text-primary d-block">job: <span><span class="text-muted">{ job }<span>
					<span class="text-primary d-block">experience: <span><span class="text-muted d-inline">{ experience } years<span>
					<span class="text-primary d-block">salary: <span><span class="text-muted d-inline">{salary} <span>
					<button class="btn btn-secondary btn-sm ml-1 rounded-0" on:click={addToSalary} >+</button>
					<button class="btn btn-light btn-sm rounded-0" on:click={reduceSalary} >-</button>
					<p class="text-danger text-right pt-4 m-0">&copy; app made it by iheb</p>
				</div>
			{/if}

		</div>
	</div>		
</main>

<style>
.titleInfo {
	font-size: 14px
}

</style>