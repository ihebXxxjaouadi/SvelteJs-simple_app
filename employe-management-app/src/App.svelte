<script>
	import { fade } from "svelte/transition";
	import Header from './components/Header.svelte'
	import InfoContainer from './components/infoContainer.svelte'
	import AddEmployee from './components/AddEmployee.svelte'

	let employes = [
		{name: 'Jhon carl', age: '21', job: 'web devolpper', experience: '2', salary: 1200 },

		{name: 'David', age: '25', job: 'web devolpper', experience: '3', salary: 1500 },

		{name: 'Rami khaled', age: '24', job: 'software engenniring', experience: '5', salary: 3000 }
	]

	let removeEmployee =(e) => {
		const employeeName = e.detail;
		employes = employes.filter( employee =>  employee.name !== employeeName )
	}

	let addEmployee = (e) => {
		const newEmployee = e.detail;
		employes = [ ...employes, newEmployee]

		console.log(employes)
	} 



</script>

<main>
	<Header />
	<AddEmployee on:addemployee={addEmployee} />

	{#each employes as employe}
		<InfoContainer 
			name={employe.name}
			age={employe.age} 
			country={employe.country} 
			job={employe.job}
			skills={employe.skills}
			experience={employe.experience},
			salary={employe.salary}  
			on:removeemploye={removeEmployee}
			/>
	{:else }		

		<div class="text-center" transition:fade={{duration:3000}}>
			<p class="text-info"> no employes </p>
		</div>
	
	{/each}
	
</main>

<style>
</style>