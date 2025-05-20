import React from 'react';
import { User } from '@/lib/types';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';

interface PatientListProps {
  patients: User[];
}

const PatientList: React.FC<PatientListProps> = ({ patients }) => {
  if (patients.length === 0) {
    return <p>No patients found.</p>;
  }

  return (
    <div className="patient-list space-y-4">
      {patients.map((patient) => (
        <Card key={patient.id}>
          <CardHeader>
            <CardTitle>{patient.firstName} {patient.lastName}</CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
};

export default PatientList;
